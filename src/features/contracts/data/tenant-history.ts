import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { assertTenantHistoryRead } from "@/lib/auth/assertions";
import type {
  TenantHistoryEntry,
  TenancyEntry,
  VoidEntry,
  HistoryStats,
  UnitHistory,
  PropertyHistory,
} from "../domain/history";
import type { EndReason } from "../domain/types";

type ContractRow = {
  id: string;
  unit_id: string;
  pm_tenant_id: string | null;
  start_date: string;
  rent_pcm: number | null;
  pro_rata_amount: number | null;
  deposit: number | null;
  vacate_date: string | null;
  actual_end_date: string | null;
  end_reason: EndReason | null;
  arrears_at_end: number | null;
  would_relet: boolean | null;
  end_notes: string | null;
  deposit_returned: number | null;
  deposit_returned_at: string | null;
  deposit_release_notes: string | null;
  status: string;
  pm_tenant?: { id: string; full_name: string } | null;
};

const DAY_MS = 86_400_000;

function daysBetween(startISO: string, endISO: string): number {
  const start = Date.parse(startISO);
  const end = Date.parse(endISO);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / DAY_MS));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function effectiveEndDate(c: ContractRow): string | null {
  return c.actual_end_date ?? null;
}

function unitLabel(unit: { unit_type: string; room_number: string | null }): string {
  if (unit.unit_type === "room") {
    return unit.room_number ? `Room ${unit.room_number}` : "Unnamed room";
  }
  if (unit.unit_type === "studio") return "Studio";
  return "Whole flat";
}

function buildEntries(contracts: ContractRow[]): TenantHistoryEntry[] {
  // Sort ascending so we can walk gaps left-to-right, then reverse at the end.
  const sorted = [...contracts].sort((a, b) =>
    a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0
  );

  const entries: TenantHistoryEntry[] = [];
  let prevEnd: string | null = null;

  for (const c of sorted) {
    if (prevEnd) {
      // Gap = days from (prevEnd + 1) up to (c.start_date - 1).
      // If next tenancy starts the same/next day, no void rendered.
      const gap = daysBetween(prevEnd, c.start_date) - 1;
      if (gap > 0) {
        entries.push({
          kind: "void",
          startDate: shiftDate(prevEnd, 1),
          endDate: shiftDate(c.start_date, -1),
          durationDays: gap,
        } satisfies VoidEntry);
      }
    }

    const end = effectiveEndDate(c);
    entries.push({
      kind: "tenancy",
      contractId: c.id,
      tenant: {
        id: c.pm_tenant?.id ?? c.pm_tenant_id ?? "",
        name: c.pm_tenant?.full_name ?? "Unknown tenant",
        avatarUrl: null,
      },
      startDate: c.start_date,
      endDate: end,
      scheduledEndDate: c.vacate_date,
      rentPence: c.rent_pcm ?? 0,
      proRataAmount: c.pro_rata_amount == null ? null : Number(c.pro_rata_amount),
      rentFrequency: "monthly",
      depositPence: c.deposit ?? null,
      endReason: c.end_reason,
      arrearsAtEndPence: c.arrears_at_end ?? 0,
      wouldRelet: c.would_relet,
      endNotes: c.end_notes,
      depositReturned: c.deposit_returned,
      depositReturnedAt: c.deposit_returned_at,
      depositReleaseNotes: c.deposit_release_notes,
      status: c.status,
    } satisfies TenancyEntry);

    prevEnd = end;
  }

  // Trailing void: last tenancy ended and no new one started → currently vacant.
  if (prevEnd) {
    const today = todayISO();
    if (prevEnd < today) {
      entries.push({
        kind: "void",
        startDate: shiftDate(prevEnd, 1),
        endDate: null,
        durationDays: Math.max(0, daysBetween(prevEnd, today) - 1),
      } satisfies VoidEntry);
    }
  }

  return entries.reverse();
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeStats(contracts: ContractRow[]): HistoryStats {
  const today = Date.now();
  const windowStart = today - 365 * DAY_MS;

  let totalDaysOccupied = 0;
  let totalDaysVoid = 0;
  let totalLengthDays = 0;
  let countedTenancies = 0;
  let occupiedInWindow = 0;

  // Sort ascending for void calc
  const sorted = [...contracts].sort((a, b) =>
    a.start_date < b.start_date ? -1 : 1
  );

  let prevEnd: string | null = null;
  for (const c of sorted) {
    const start = Date.parse(c.start_date);
    const endISO = effectiveEndDate(c) ?? new Date(today).toISOString().slice(0, 10);
    const end = Date.parse(endISO);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      const len = Math.round((end - start) / DAY_MS);
      totalDaysOccupied += len;
      // Average tenancy length only counts ended tenancies.
      if (effectiveEndDate(c)) {
        totalLengthDays += len;
        countedTenancies += 1;
      }
      // Overlap with [windowStart, today]
      const ovStart = Math.max(start, windowStart);
      const ovEnd = Math.min(end, today);
      if (ovEnd > ovStart) {
        occupiedInWindow += Math.round((ovEnd - ovStart) / DAY_MS);
      }
    }

    if (prevEnd) {
      const gap = daysBetween(prevEnd, c.start_date) - 1;
      if (gap > 0) totalDaysVoid += gap;
    }
    prevEnd = effectiveEndDate(c);
  }

  if (prevEnd) {
    const t = todayISO();
    if (prevEnd < t) totalDaysVoid += Math.max(0, daysBetween(prevEnd, t) - 1);
  }

  const occupancyPct =
    Math.min(100, Math.round((occupiedInWindow / 365) * 1000) / 10);

  return {
    totalTenancies: contracts.length,
    totalDaysOccupied,
    totalDaysVoid,
    occupancyPct,
    averageTenancyDays:
      countedTenancies > 0 ? Math.round(totalLengthDays / countedTenancies) : 0,
  };
}

const HISTORY_SELECT = `
  id, unit_id, pm_tenant_id, start_date, rent_pcm, pro_rata_amount, deposit,
  vacate_date, actual_end_date, end_reason, arrears_at_end,
  would_relet, end_notes,
  deposit_returned, deposit_returned_at, deposit_release_notes,
  status,
  pm_tenant:pm_tenants(id, full_name)
`;

export async function getUnitTenantHistory(unitId: string): Promise<UnitHistory> {
  const unit = await assertTenantHistoryRead(unitId);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("property_contracts")
    .select(HISTORY_SELECT)
    .eq("unit_id", unitId)
    .order("start_date", { ascending: false });

  if (error) throw new Error(error.message);
  const contracts = (data ?? []) as unknown as ContractRow[];

  return {
    unit: {
      id: unit.id,
      label: unitLabel(unit),
      propertyId: unit.property_id,
      status: "",
    },
    entries: buildEntries(contracts),
    stats: computeStats(contracts),
  };
}

export async function getPropertyTenantHistory(
  propertyId: string
): Promise<PropertyHistory> {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();

  // Property scoping
  const { data: property, error: pErr } = await supabase
    .from("properties")
    .select("id, name, address_line_1, area, postcode")
    .eq("id", propertyId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!property) throw new Error("Property not found");

  // Units for the property
  const { data: units, error: uErr } = await supabase
    .from("units")
    .select("id, unit_type, room_number, status")
    .eq("property_id", propertyId)
    .eq("tenant_id", profile.tenant_id)
    .order("room_number", { ascending: true, nullsFirst: true });
  if (uErr) throw new Error(uErr.message);
  const unitRows = (units ?? []) as Array<{
    id: string;
    unit_type: string;
    room_number: string | null;
    status: string;
  }>;

  // All contracts for the unit set, single query
  const unitIds = unitRows.map((u) => u.id);
  let contracts: ContractRow[] = [];
  if (unitIds.length > 0) {
    const { data, error } = await supabase
      .from("property_contracts")
      .select(HISTORY_SELECT)
      .in("unit_id", unitIds)
      .eq("tenant_id", profile.tenant_id);
    if (error) throw new Error(error.message);
    contracts = (data ?? []) as unknown as ContractRow[];
  }

  const byUnit = new Map<string, ContractRow[]>();
  for (const c of contracts) {
    const list = byUnit.get(c.unit_id) ?? [];
    list.push(c);
    byUnit.set(c.unit_id, list);
  }

  const unitHistories: UnitHistory[] = unitRows.map((u) => {
    const list = byUnit.get(u.id) ?? [];
    return {
      unit: {
        id: u.id,
        label: unitLabel(u),
        propertyId: propertyId,
        status: u.status,
      },
      entries: buildEntries(list),
      stats: computeStats(list),
    };
  });

  return {
    property: {
      id: property.id,
      address: [property.name, property.address_line_1, property.area, property.postcode]
        .filter(Boolean)
        .join(", "),
    },
    units: unitHistories,
    rollup: computeStats(contracts),
  };
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import {
  expectedRent,
  inclusiveMonthsBetween,
} from "@/features/contracts/domain/pro-rata";

export type RentCollectionRow = {
  contractId: string;
  unitId: string;
  pmTenantId: string;
  status: string;
  startDate: string;
  rentPcm: number;
  proRataAmount: number | null;
  collectionDate: number | null;
  monthsCovered: number;
  paid: number;
  expected: number;
  arrears: number;
  currentMonthPaid: boolean;
  lastPaidAt: string | null;
  tenant: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  property: {
    id: string;
    name: string;
    addressLine1: string;
    portfolio: { name: string; color: string } | null;
  };
  unit: {
    roomNumber: string | null;
    unitType: string;
  };
};

const ACTIVE_STATUSES = ["active", "signed", "notice_given"] as const;

const SELECT = `
  id, unit_id, pm_tenant_id, start_date, rent_pcm, pro_rata_amount, collection_date, status,
  pm_tenant:pm_tenants(id, full_name, email, phone),
  unit:units(
    room_number, unit_type,
    property:properties(id, name, address_line_1, portfolio:portfolios(name, color))
  )
`;

type RawContract = {
  id: string;
  unit_id: string;
  pm_tenant_id: string;
  start_date: string;
  rent_pcm: number;
  pro_rata_amount: number | string | null;
  collection_date: number | null;
  status: string;
  pm_tenant: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  unit: {
    room_number: string | null;
    unit_type: string;
    property: {
      id: string;
      name: string;
      address_line_1: string;
      portfolio: { name: string; color: string } | null;
    } | null;
  } | null;
};

export async function getRentCollectionRows(): Promise<RentCollectionRow[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: contracts, error: cErr } = await supabase
    .from("property_contracts")
    .select(SELECT)
    .in("status", [...ACTIVE_STATUSES])
    .order("start_date", { ascending: false });

  if (cErr) throw new Error(cErr.message);
  const rows = (contracts ?? []) as unknown as RawContract[];
  if (rows.length === 0) return [];

  const contractIds = rows.map((r) => r.id);
  const { data: payments, error: pErr } = await supabase
    .from("rent_payments")
    .select("contract_id, period_year, period_month, amount, paid_at")
    .in("contract_id", contractIds)
    .eq("tenant_id", profile.tenant_id);
  if (pErr) throw new Error(pErr.message);

  type Aggregate = {
    paid: number;
    currentMonthPaid: boolean;
    lastPaidAt: string | null;
  };
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const todayIso = now.toISOString().slice(0, 10);

  const agg = new Map<string, Aggregate>();
  for (const p of payments ?? []) {
    const a = agg.get(p.contract_id) ?? {
      paid: 0,
      currentMonthPaid: false,
      lastPaidAt: null,
    };
    a.paid += Number(p.amount);
    if (p.period_year === currentYear && p.period_month === currentMonth) {
      a.currentMonthPaid = true;
    }
    if (!a.lastPaidAt || p.paid_at > a.lastPaidAt) {
      a.lastPaidAt = p.paid_at;
    }
    agg.set(p.contract_id, a);
  }

  return rows.map<RentCollectionRow>((r) => {
    const a = agg.get(r.id) ?? { paid: 0, currentMonthPaid: false, lastPaidAt: null };
    const rentPcm = Number(r.rent_pcm ?? 0);
    const proRata = r.pro_rata_amount == null ? null : Number(r.pro_rata_amount);
    const monthsCovered = inclusiveMonthsBetween(r.start_date, todayIso);
    const expected = expectedRent(r.start_date, todayIso, rentPcm, proRata);
    const arrears = Math.max(0, Math.round(expected - a.paid));

    return {
      contractId: r.id,
      unitId: r.unit_id,
      pmTenantId: r.pm_tenant_id,
      status: r.status,
      startDate: r.start_date,
      rentPcm,
      proRataAmount: proRata,
      collectionDate: r.collection_date,
      monthsCovered,
      paid: Math.round(a.paid),
      expected: Math.round(expected),
      arrears,
      currentMonthPaid: a.currentMonthPaid,
      lastPaidAt: a.lastPaidAt,
      tenant: {
        id: r.pm_tenant?.id ?? r.pm_tenant_id,
        name: r.pm_tenant?.full_name ?? "Unknown tenant",
        email: r.pm_tenant?.email ?? null,
        phone: r.pm_tenant?.phone ?? null,
      },
      property: {
        id: r.unit?.property?.id ?? "",
        name: r.unit?.property?.name ?? "—",
        addressLine1: r.unit?.property?.address_line_1 ?? "",
        portfolio: r.unit?.property?.portfolio ?? null,
      },
      unit: {
        roomNumber: r.unit?.room_number ?? null,
        unitType: r.unit?.unit_type ?? "",
      },
    };
  });
}

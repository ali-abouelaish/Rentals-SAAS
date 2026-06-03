import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { TenantRecurringCharge } from "../domain/tenant-charges";

export type TenantChargeContractRef = {
  contract_id: string;
  tenant_name: string;
  property_name: string;
  unit_label: string;
  start_date: string;
  status: string;
  rent_pcm: number;
};

export type TenantChargeWithContext = TenantRecurringCharge & {
  context: TenantChargeContractRef | null;
};

const CONTRACT_SELECT = `
  id, start_date, rent_pcm, status,
  pm_tenant:pm_tenants(full_name),
  unit:units(room_number, unit_type, property:properties(name))
`;

type RawContract = {
  id: string;
  start_date: string;
  rent_pcm: number;
  status: string;
  pm_tenant: { full_name: string } | null;
  unit: {
    room_number: string | null;
    unit_type: string;
    property: { name: string } | null;
  } | null;
};

function unitLabel(unit: RawContract["unit"]): string {
  if (!unit) return "—";
  if (unit.unit_type === "room" && unit.room_number) return `Room ${unit.room_number}`;
  if (unit.unit_type === "studio") return "Studio";
  return "Whole Flat";
}

export async function listTenantCharges(): Promise<TenantChargeWithContext[]> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: charges, error } = await supabase
    .from("tenant_recurring_charges")
    .select("*")
    .order("is_active", { ascending: false })
    .order("start_date", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (charges ?? []) as TenantRecurringCharge[];
  if (rows.length === 0) return [];

  const contractIds = Array.from(new Set(rows.map((r) => r.contract_id)));
  const { data: contracts, error: cErr } = await supabase
    .from("property_contracts")
    .select(CONTRACT_SELECT)
    .in("id", contractIds);
  if (cErr) throw new Error(cErr.message);

  const contractMap = new Map<string, TenantChargeContractRef>();
  for (const raw of (contracts ?? []) as unknown as RawContract[]) {
    contractMap.set(raw.id, {
      contract_id: raw.id,
      tenant_name: raw.pm_tenant?.full_name ?? "Unknown tenant",
      property_name: raw.unit?.property?.name ?? "—",
      unit_label: unitLabel(raw.unit),
      start_date: raw.start_date,
      status: raw.status,
      rent_pcm: Number(raw.rent_pcm ?? 0),
    });
  }

  return rows.map((r) => ({ ...r, context: contractMap.get(r.contract_id) ?? null }));
}

export type ContractOption = TenantChargeContractRef;

/** Active-ish contracts that can have recurring charges attached. */
export async function listChargeableContracts(): Promise<ContractOption[]> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("property_contracts")
    .select(CONTRACT_SELECT)
    .in("status", ["active", "signed", "notice_given"])
    .order("start_date", { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as RawContract[]).map((raw) => ({
    contract_id: raw.id,
    tenant_name: raw.pm_tenant?.full_name ?? "Unknown tenant",
    property_name: raw.unit?.property?.name ?? "—",
    unit_label: unitLabel(raw.unit),
    start_date: raw.start_date,
    status: raw.status,
    rent_pcm: Number(raw.rent_pcm ?? 0),
  }));
}

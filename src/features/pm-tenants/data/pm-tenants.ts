import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PmTenant, PmTenantFilters } from "../domain/types";

const ACTIVE_CONTRACT_STATUSES = ["active", "signed", "notice_given"];

type CurrentContractRow = {
  id: string;
  start_date: string;
  expiry_date: string | null;
  rent_pcm: number;
  deposit: number;
  collection_date: number | null;
  pro_rata_amount: number | null;
  prepaid_first_full_month: boolean;
  deposit_scheme: string | null;
  deposit_scheme_ref: string | null;
  deposit_protected_date: string | null;
  signing_method: string | null;
  status: string;
  notice_given_by: string | null;
  notice_given_date: string | null;
  vacate_date: string | null;
  actual_end_date: string | null;
  end_reason: string | null;
  document_url: string | null;
  notes: string | null;
};

const CURRENT_CONTRACT_COLUMNS =
  "id, start_date, expiry_date, rent_pcm, deposit, collection_date, pro_rata_amount, prepaid_first_full_month, deposit_scheme, deposit_scheme_ref, deposit_protected_date, signing_method, status, notice_given_by, notice_given_date, vacate_date, actual_end_date, end_reason, document_url, notes";

function pickCurrentContract(
  contracts: CurrentContractRow[] | null | undefined
) {
  if (!contracts || contracts.length === 0) return null;
  const active = contracts.find((c) => ACTIVE_CONTRACT_STATUSES.includes(c.status));
  if (active) return active;
  return [...contracts].sort((a, b) => (a.start_date < b.start_date ? 1 : -1))[0] ?? null;
}

function flattenTenantRelations<T extends { current_unit?: unknown; current_contract?: unknown }>(
  row: T
): T {
  const unitRel = row.current_unit as unknown;
  const contractRel = row.current_contract as unknown;
  return {
    ...row,
    current_unit: Array.isArray(unitRel) ? unitRel[0] ?? null : unitRel ?? null,
    current_contract: Array.isArray(contractRel)
      ? pickCurrentContract(contractRel as CurrentContractRow[])
      : contractRel ?? null,
  } as T;
}

export async function getPmTenants(
  filters: Partial<PmTenantFilters> = {}
): Promise<PmTenant[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("pm_tenants")
    .select(
      `*,
      guarantors(*),
      current_unit:units!units_pm_tenant_id_fkey(
        id, room_number, unit_type,
        property:properties(name, address_line_1)
      ),
      current_contract:property_contracts(${CURRENT_CONTRACT_COLUMNS})`
    )
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);

  const result = ((data ?? []) as PmTenant[]).map(flattenTenantRelations);

  if (!filters.search) return result;
  const s = filters.search.toLowerCase();
  return result.filter(
    (t) =>
      t.full_name.toLowerCase().includes(s) ||
      t.email.toLowerCase().includes(s) ||
      t.phone.includes(s)
  );
}

export async function getPmTenantById(id: string): Promise<PmTenant | null> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("pm_tenants")
    .select(
      `*,
      guarantors(*),
      current_unit:units!units_pm_tenant_id_fkey(
        id, room_number, unit_type,
        property:properties(name, address_line_1)
      ),
      current_contract:property_contracts(${CURRENT_CONTRACT_COLUMNS})`
    )
    .eq("id", id)
    .single();

  if (error) return null;
  return flattenTenantRelations(data as PmTenant);
}

export async function getPmTenantFormResponses(pmTenantId: string) {
  const supabase = createSupabaseServerClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id")
    .eq("converted_pm_tenant_id", pmTenantId)
    .single();

  if (!booking) return [];

  const { data, error } = await supabase
    .from("form_responses")
    .select("*, question:form_questions(*)")
    .eq("booking_id", booking.id)
    .order("created_at", { ascending: true });

  if (error) return [];
  return data ?? [];
}

export async function getPmTenantContractHistory(pmTenantId: string) {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("property_contracts")
    .select(
      `*, unit:units(room_number, unit_type, property:properties(name, address_line_1))`
    )
    .eq("pm_tenant_id", pmTenantId)
    .order("start_date", { ascending: false });

  if (error) return [];
  return data ?? [];
}

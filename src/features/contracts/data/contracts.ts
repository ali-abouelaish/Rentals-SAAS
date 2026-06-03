import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PropertyContract, ContractFilters } from "../domain/types";

const SELECT = `*,
  pm_tenant:pm_tenants(id, full_name, email, phone),
  unit:units(
    id, room_number, unit_type,
    property:properties(id, name, address_line_1, portfolio:portfolios(id, name, color))
  )`;

export async function getContracts(
  filters: Partial<ContractFilters> = {}
): Promise<PropertyContract[]> {
  const supabase = createSupabaseServerClient();

  let query = supabase
    .from("property_contracts")
    .select(SELECT)
    .order("created_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let result = (data ?? []) as PropertyContract[];

  if (filters.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(
      (c) =>
        c.pm_tenant?.full_name.toLowerCase().includes(s) ||
        c.unit?.property.name.toLowerCase().includes(s) ||
        c.unit?.property.address_line_1.toLowerCase().includes(s)
    );
  }

  if (filters.portfolioId) {
    result = result.filter(
      (c) => c.unit?.property.portfolio && (c.unit.property.portfolio as { id?: string }).id === filters.portfolioId
    );
  }

  if (filters.depositProtected === "yes") {
    result = result.filter((c) => !!c.deposit_protected_date);
  } else if (filters.depositProtected === "no") {
    result = result.filter((c) => !c.deposit_protected_date);
  }

  return result;
}

export async function getContractById(id: string): Promise<PropertyContract | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("property_contracts")
    .select(SELECT)
    .eq("id", id)
    .single();
  if (error) return null;
  return data as PropertyContract;
}

export async function getContractsByUnit(unitId: string): Promise<PropertyContract[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("property_contracts")
    .select(SELECT)
    .eq("unit_id", unitId)
    .order("start_date", { ascending: false });
  if (error) return [];
  return (data ?? []) as PropertyContract[];
}

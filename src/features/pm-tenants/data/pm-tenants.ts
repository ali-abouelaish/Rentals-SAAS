import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PmTenant, PmTenantFilters } from "../domain/types";

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
      current_contract:property_contracts(start_date, status)`
    )
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);

  let result = (data ?? []) as PmTenant[];

  if (filters.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(
      (t) =>
        t.full_name.toLowerCase().includes(s) ||
        t.email.toLowerCase().includes(s) ||
        t.phone.includes(s)
    );
  }

  if (filters.nationality) {
    const n = filters.nationality.toLowerCase();
    result = result.filter((t) => t.nationality?.toLowerCase() === n);
  }

  if (filters.employment_status) {
    result = result.filter((t) => t.employment_status === filters.employment_status);
  }

  if (filters.rtr_status) {
    const today = new Date().toISOString().slice(0, 10);
    result = result.filter((t) => {
      if (filters.rtr_status === "verified") return t.right_to_rent_verified;
      if (filters.rtr_status === "expired")
        return t.right_to_rent_expiry && t.right_to_rent_expiry < today;
      if (filters.rtr_status === "unverified")
        return (
          !t.right_to_rent_verified &&
          (!t.right_to_rent_expiry || t.right_to_rent_expiry >= today)
        );
      return true;
    });
  }

  return result;
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
      current_contract:property_contracts(start_date, status)`
    )
    .eq("id", id)
    .single();

  if (error) return null;
  return data as PmTenant;
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

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";

export async function getBillingProfiles() {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const { data, error } = await supabase
    .from("billing_profiles")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getInvoices({
  search,
  status
}: {
  search?: string;
  status?: string;
} = {}) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("invoices")
    .select(
      "*, landlords(name), created_by:user_profiles!invoices_created_by_user_id_fkey(display_name), approved_by:user_profiles!invoices_approved_by_user_id_fkey(display_name)"
    )
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `invoice_number.ilike.%${search}%,landlords.name.ilike.%${search}%`
    );
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getInvoiceById(id: string) {
  const supabase = createSupabaseServerClient();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, landlords(*), billing_profiles(*), created_by:user_profiles!invoices_created_by_user_id_fkey(display_name), approved_by:user_profiles!invoices_approved_by_user_id_fkey(display_name)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);

  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("sort_order", { ascending: true });

  const { data: bonusLinks } = await supabase
    .from("invoice_bonus_links")
    .select("bonus_id")
    .eq("invoice_id", id);

  return {
    invoice,
    items: items ?? [],
    bonusIds: bonusLinks?.map((link) => link.bonus_id) ?? []
  };
}

export async function getBonusesForInvoice() {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  let query = supabase
    .from("bonuses")
    .select("id, landlord_id, amount_owed, code, status, landlords(name, billing_address)")
    .eq("tenant_id", profile.tenant_id)
    .in("status", ["approved", "pending"])
    .order("created_at", { ascending: false });

  if (profile.role.toLowerCase() !== "admin") {
    query = query.eq("agent_id", profile.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

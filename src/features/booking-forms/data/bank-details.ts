import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { PortfolioBankDetails } from "../domain/types";

export async function getBankDetailsForPortfolio(portfolioId: string): Promise<PortfolioBankDetails[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("portfolio_bank_details")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .eq("portfolio_id", portfolioId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PortfolioBankDetails[];
}

export async function getAllBankDetailsForTenant(): Promise<PortfolioBankDetails[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("portfolio_bank_details")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("portfolio_id", { ascending: true })
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PortfolioBankDetails[];
}

// Public — used on /apply pages (no auth). Resolves bank details for a form by
// preferring the form's explicit override, falling back to the portfolio default.
export async function getPublicBankDetailsForForm(formId: string): Promise<PortfolioBankDetails | null> {
  const supabase = createSupabaseAdminClient();

  const { data: form } = await supabase
    .from("booking_forms")
    .select("bank_details_id, portfolio_id")
    .eq("id", formId)
    .maybeSingle<{ bank_details_id: string | null; portfolio_id: string | null }>();

  if (!form) return null;

  if (form.bank_details_id) {
    const { data } = await supabase
      .from("portfolio_bank_details")
      .select("*")
      .eq("id", form.bank_details_id)
      .maybeSingle();
    if (data) return data as PortfolioBankDetails;
  }

  if (!form.portfolio_id) return null;

  const { data: fallback } = await supabase
    .from("portfolio_bank_details")
    .select("*")
    .eq("portfolio_id", form.portfolio_id)
    .eq("is_default", true)
    .maybeSingle();

  return (fallback as PortfolioBankDetails | null) ?? null;
}

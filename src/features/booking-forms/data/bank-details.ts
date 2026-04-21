import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { FormBankDetails } from "../domain/types";

export async function getBankDetailsForForm(formId: string): Promise<FormBankDetails | null> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("booking_form_bank_details")
    .select("*")
    .eq("form_id", formId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as FormBankDetails | null) ?? null;
}

export async function getAllBankDetailsForTenant(): Promise<FormBankDetails[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("booking_form_bank_details")
    .select("*")
    .eq("tenant_id", profile.tenant_id);

  if (error) throw new Error(error.message);
  return (data as FormBankDetails[] | null) ?? [];
}

// Public — used on /apply pages (no auth). Scoped by form_id resolved
// server-side from the form slug, so no user-supplied id is trusted.
export async function getPublicBankDetailsForForm(formId: string): Promise<FormBankDetails | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("booking_form_bank_details")
    .select("*")
    .eq("form_id", formId)
    .maybeSingle();
  return (data as FormBankDetails | null) ?? null;
}

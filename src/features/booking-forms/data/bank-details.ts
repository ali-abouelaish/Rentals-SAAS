import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { TenantBankDetails } from "../domain/types";

export async function getBankDetails(): Promise<TenantBankDetails | null> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("tenant_bank_details")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as TenantBankDetails | null) ?? null;
}

// Public — used on /apply pages (no auth). Scoped by tenant_id resolved
// server-side from the form slug, so no user-supplied tenant_id is trusted.
export async function getPublicBankDetails(tenantId: string): Promise<TenantBankDetails | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("tenant_bank_details")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as TenantBankDetails | null) ?? null;
}

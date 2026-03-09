import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";

export async function getTenantBillingInfo() {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const { data, error } = await supabase
    .from("tenant_billing_info")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

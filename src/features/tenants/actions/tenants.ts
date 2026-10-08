// Server-only helper, deliberately NOT "use server": it provisions a tenant with
// the service-role key for an arbitrary user id, so it must never be exposed as
// a client-callable server action. Its only caller is requireUserProfile.
import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function ensureTenantSetup(userId: string, email?: string) {
  const supabase = createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (existingError) throw new Error(`Could not load your profile: ${existingError.message}`);

  if (existing) return existing;

  const admin = createSupabaseAdminClient();
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({
      name: "Demo Agency",
      // In dev, use a fixed slug so the NOT NULL / UNIQUE constraint is satisfied.
      // For multi-tenant production setups this can be replaced with a real slug.
      slug: "demo-agency"
    })
    .select("*")
    .single();
  if (tenantError) throw new Error(tenantError.message);

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .insert({
      id: userId,
      tenant_id: tenant.id,
      role: "admin",
      display_name: email?.split("@")[0] ?? "Admin"
    })
    .select("*")
    .single();
  if (profileError) throw new Error(profileError.message);

  await admin.from("agent_profiles").insert({
    user_id: userId,
    tenant_id: tenant.id,
    commission_percent: 20,
    marketing_fee: 50,
    role_flags: { is_agent: true, is_marketing: true }
  });

  return profile;
}

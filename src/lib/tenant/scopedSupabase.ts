import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Tenant = { id: string };

export function createScopedSupabase(tenant: Tenant) {
  const supabase = createSupabaseAdminClient();

  const from = (table: string) =>
    supabase.from(table as any).eq("tenant_id", tenant.id);

  return {
    tenant,
    supabase,
    from,
  };
}

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Tenant = { id: string };

export function createScopedSupabase(tenant: Tenant) {
  const supabase = createSupabaseAdminClient();

  const from = (table: string) => {
    const base = supabase.from(table as any);
    return {
      select: (...args: unknown[]) =>
        base.select(...(args as [])).eq("tenant_id", tenant.id),
      insert: (data: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(data) ? data : [data];
        const withTenant = rows.map((row) => ({ ...row, tenant_id: tenant.id }));
        return base.insert(withTenant as any);
      },
      update: (data: Record<string, unknown>) =>
        base.update(data as any).eq("tenant_id", tenant.id),
      delete: () => base.delete().eq("tenant_id", tenant.id),
    };
  };

  return {
    tenant,
    supabase,
    from,
  };
}

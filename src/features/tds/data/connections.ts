import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/requireRole";
import type { TdsAgencyRow, TdsConnection } from "../domain/types";

// Every selectable column on tds_connections EXCEPT api_key. The encrypted secret
// must never be read into the UI layer.
const CONNECTION_COLUMNS =
  "tenant_id, environment, member_id, branch_id, region, scheme_type, account_label, connected_by, last_verified_at, last_error, created_at, updated_at";

/**
 * List every agency (tenant) alongside its TDS connection status, for the super
 * admin "Deposit Schemes" tab. Super-admin only; never selects api_key.
 */
export async function getTdsAgencies(): Promise<TdsAgencyRow[]> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data: tenants, error: tenantsError }, { data: connections, error: connError }] =
    await Promise.all([
      admin.from("tenants").select("id, name, slug, status").order("name", { ascending: true }),
      admin.from("tds_connections").select(CONNECTION_COLUMNS),
    ]);

  if (tenantsError) throw new Error(tenantsError.message);
  if (connError) throw new Error(connError.message);

  const byTenant = new Map<string, TdsConnection>(
    (connections ?? []).map((row) => [row.tenant_id as string, row as TdsConnection])
  );

  return (tenants ?? []).map((tenant) => ({
    tenant: {
      id: tenant.id as string,
      name: tenant.name as string,
      slug: tenant.slug as string,
      status: tenant.status as string,
    },
    connection: byTenant.get(tenant.id as string) ?? null,
  }));
}

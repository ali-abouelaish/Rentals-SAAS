import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/requireRole";
import type { DpsAgencyRow, DpsConnection } from "../domain/types";

// Every selectable column on dps_connections EXCEPT client_secret. The
// encrypted secret must never be read into the UI layer.
const CONNECTION_COLUMNS =
  "tenant_id, environment, agent_landlord_id, client_id, account_label, connected_by, last_verified_at, last_error, created_at, updated_at";

/**
 * List every agency (tenant) alongside its DPS connection status, for the
 * super admin "Deposit Schemes" tab. Super-admin only; never selects
 * client_secret.
 */
export async function getDpsAgencies(): Promise<DpsAgencyRow[]> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const [{ data: tenants, error: tenantsError }, { data: connections, error: connError }] =
    await Promise.all([
      admin.from("tenants").select("id, name, slug, status").order("name", { ascending: true }),
      admin.from("dps_connections").select(CONNECTION_COLUMNS),
    ]);

  if (tenantsError) throw new Error(tenantsError.message);
  if (connError) throw new Error(connError.message);

  const byTenant = new Map<string, DpsConnection>(
    (connections ?? []).map((row) => [row.tenant_id as string, row as DpsConnection])
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

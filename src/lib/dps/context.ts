// Per-tenant DPS auth context, analogous to getTdsContext.
//
// Loads the tenant's dps_connections row via the service-role admin client,
// decrypts the client_secret, and returns everything the deposit lifecycle
// needs. Token acquisition itself is handled lazily by the api client (the
// 20-minute bearer token is cached in-process, see token.ts). Server-only.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptDpsSecret } from "./encrypt";
import { dpsApiBase, type DpsEnvironment } from "./config";
import type { DpsCredentials } from "./apiClient";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type DpsContext = {
  tenantId: string;
  environment: DpsEnvironment;
  agentLandlordId: string;
  clientId: string;
  clientSecret: string;
  creds: DpsCredentials;
  apiBase: string;
  admin: AdminClient;
};

/**
 * Load the tenant's DPS connection and decrypt its client_secret. Throws when
 * the tenant has no connection (a super admin must configure one first).
 */
export async function getDpsContext(tenantId: string): Promise<DpsContext> {
  const admin = createSupabaseAdminClient();
  const { data: conn, error } = await admin
    .from("dps_connections")
    .select("environment, agent_landlord_id, client_id, client_secret")
    .eq("tenant_id", tenantId)
    .single();

  if (error || !conn) {
    throw new Error(`No DPS connection for tenant ${tenantId}`);
  }

  const environment = (conn.environment as DpsEnvironment) ?? "uat";
  const agentLandlordId = conn.agent_landlord_id as string;
  const clientId = conn.client_id as string;
  const clientSecret = decryptDpsSecret(conn.client_secret as string);

  return {
    tenantId,
    environment,
    agentLandlordId,
    clientId,
    clientSecret,
    creds: { environment, clientId, clientSecret, agentLandlordId },
    apiBase: dpsApiBase(environment),
    admin,
  };
}

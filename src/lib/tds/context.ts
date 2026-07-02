// Per-tenant TDS auth context, analogous to mydeposits' getMdContext.
//
// Unlike mydeposits there is no OAuth token to refresh — TDS auth is static
// path-based credentials (member_id / branch_id / api_key). getTdsContext loads
// the tenant's tds_connections row via the service-role admin client, decrypts
// the api_key, and returns everything the deposit lifecycle needs. Server-only.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptTdsSecret } from "./encrypt";
import {
  tdsApiBase,
  type TdsEnvironment,
  type TdsRegion,
  type TdsSchemeType,
} from "./config";
import type { TdsCredentials } from "./apiClient";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type TdsContext = {
  tenantId: string;
  environment: TdsEnvironment;
  memberId: string;
  branchId: string;
  apiKey: string;
  region: TdsRegion;
  schemeType: TdsSchemeType;
  creds: TdsCredentials;
  apiBase: string;
  admin: AdminClient;
};

/**
 * Load the tenant's TDS connection and decrypt its api_key. Throws when the
 * tenant has no connection (a super admin must configure one first).
 */
export async function getTdsContext(tenantId: string): Promise<TdsContext> {
  const admin = createSupabaseAdminClient();
  const { data: conn, error } = await admin
    .from("tds_connections")
    .select("environment, member_id, branch_id, api_key, region, scheme_type")
    .eq("tenant_id", tenantId)
    .single();

  if (error || !conn) {
    throw new Error(`No TDS connection for tenant ${tenantId}`);
  }

  const environment = (conn.environment as TdsEnvironment) ?? "sandbox";
  const memberId = conn.member_id as string;
  const branchId = (conn.branch_id as string) ?? "0";
  const region = (conn.region as TdsRegion) ?? "EW";
  const schemeType = (conn.scheme_type as TdsSchemeType) ?? "Custodial";
  const apiKey = decryptTdsSecret(conn.api_key as string);

  return {
    tenantId,
    environment,
    memberId,
    branchId,
    apiKey,
    region,
    schemeType,
    creds: { environment, memberId, branchId, apiKey },
    apiBase: tdsApiBase(environment),
    admin,
  };
}

import type { TdsEnvironment, TdsRegion, TdsSchemeType } from "@/lib/tds/config";

export type { TdsEnvironment, TdsRegion, TdsSchemeType };

/**
 * A tenant's stored TDS connection. Mirrors the tds_connections table MINUS the
 * secret api_key — the encrypted key never leaves the server.
 */
export type TdsConnection = {
  tenant_id: string;
  environment: TdsEnvironment;
  member_id: string;
  branch_id: string;
  region: TdsRegion;
  scheme_type: TdsSchemeType;
  account_label: string | null;
  connected_by: string | null;
  last_verified_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

/** One row in the super-admin Deposit Schemes overview: an agency + its (optional) TDS connection. */
export type TdsAgencyRow = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  connection: TdsConnection | null;
};

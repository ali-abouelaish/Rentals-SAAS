import type { DpsEnvironment } from "@/lib/dps/config";

export type { DpsEnvironment };

/**
 * A tenant's stored DPS connection. Mirrors the dps_connections table MINUS
 * the secret client_secret — the encrypted secret never leaves the server.
 */
export type DpsConnection = {
  tenant_id: string;
  environment: DpsEnvironment;
  agent_landlord_id: string;
  client_id: string;
  account_label: string | null;
  connected_by: string | null;
  last_verified_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

/** One row in the super-admin Deposit Schemes overview: an agency + its (optional) DPS connection. */
export type DpsAgencyRow = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  connection: DpsConnection | null;
};

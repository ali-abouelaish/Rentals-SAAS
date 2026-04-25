export type PublicApiKey = {
  id: string;
  tenant_id: string;
  label: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashApiKey, extractBearer } from "./hash";

export type VerifiedApiKey = {
  id: string;
  tenant_id: string;
  scopes: string[];
};

/** Verify a bearer / x-api-key header against public_api_keys.
 *  Returns the matched row (and asynchronously bumps last_used_at) or null. */
export async function verifyPublicApiKey(headers: Headers): Promise<VerifiedApiKey | null> {
  const raw =
    extractBearer(headers.get("authorization")) ??
    headers.get("x-api-key")?.trim() ??
    null;
  if (!raw) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("public_api_keys")
    .select("id, tenant_id, scopes, revoked_at")
    .eq("key_hash", hashApiKey(raw))
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;

  // Fire-and-forget last_used_at update; don't block the response.
  void supabase
    .from("public_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { id: data.id, tenant_id: data.tenant_id, scopes: data.scopes ?? [] };
}

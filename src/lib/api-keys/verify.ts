import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashApiKey, extractBearer } from "./hash";

export type VerifiedApiKey = {
  id: string;
  tenant_id: string;
  scopes: string[];
};

/** Real keys are 48 characters ("hopk_" + 43); anything far longer isn't one. */
const MAX_KEY_LENGTH = 200;

/** The key from an Authorization (Bearer) or x-api-key header, if any. */
export function apiKeyFromHeaders(headers: Headers): string | null {
  const raw =
    extractBearer(headers.get("authorization")) ??
    headers.get("x-api-key")?.trim() ??
    null;
  return raw || null;
}

/** Verify a raw key against public_api_keys.
 *  Returns the matched row (and bumps last_used_at in the background) or null. */
export async function verifyApiKeyValue(raw: string): Promise<VerifiedApiKey | null> {
  const value = raw.trim();
  if (!value || value.length > MAX_KEY_LENGTH) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("public_api_keys")
    .select("id, tenant_id, scopes, revoked_at")
    .eq("key_hash", hashApiKey(value))
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;

  // Don't block the response on the timestamp. A query builder only sends its
  // request once then() is called, so this must chain .then() — a bare
  // `void builder` never ran, which is why every key used to read "never used".
  void supabase
    .from("public_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(
      ({ error: touchError }) => {
        if (touchError) console.error("[api-keys] last_used_at update failed", touchError.code);
      },
      (err: unknown) => {
        console.error("[api-keys] last_used_at update failed", err instanceof Error ? err.name : "unknown");
      }
    );

  return { id: data.id, tenant_id: data.tenant_id, scopes: data.scopes ?? [] };
}

/** Verify a bearer / x-api-key header against public_api_keys. */
export async function verifyPublicApiKey(headers: Headers): Promise<VerifiedApiKey | null> {
  const raw = apiKeyFromHeaders(headers);
  if (!raw) return null;
  return verifyApiKeyValue(raw);
}

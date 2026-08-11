import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { randomState } from "@/lib/mydeposits/pkce";

const TEN_MIN_MS = 10 * 60 * 1000;

export type OAuthStateProvider = "graph" | "gmail";

/**
 * Persist an OAuth state row and return the opaque state nonce. Used instead of
 * a cookie so the flow survives the hop from the tenant subdomain (where the
 * connect request runs) to the fixed callback host.
 */
export async function createOAuthState({
  tenantId,
  provider,
  codeVerifier,
}: {
  tenantId: string;
  provider: OAuthStateProvider;
  codeVerifier: string;
}): Promise<string> {
  const state = randomState();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("email_provider_oauth_states").insert({
    state,
    tenant_id: tenantId,
    provider,
    code_verifier: codeVerifier,
    expires_at: new Date(Date.now() + TEN_MIN_MS).toISOString(),
  });
  if (error) throw new Error(error.message);
  return state;
}

/**
 * Validate and consume a state nonce (one-time use). Returns the tenant +
 * verifier, or null if the state is unknown, for the wrong provider, or expired.
 * Also opportunistically prunes expired rows.
 */
export async function consumeOAuthState(
  state: string,
  provider: OAuthStateProvider,
): Promise<{ tenantId: string; codeVerifier: string } | null> {
  const admin = createSupabaseAdminClient();

  const { data } = await admin
    .from("email_provider_oauth_states")
    .select("tenant_id, provider, code_verifier, expires_at")
    .eq("state", state)
    .maybeSingle();

  // One-time use: remove the row (and any expired ones) regardless of outcome.
  await admin.from("email_provider_oauth_states").delete().eq("state", state);
  await admin
    .from("email_provider_oauth_states")
    .delete()
    .lt("expires_at", new Date().toISOString());

  if (!data || data.provider !== provider) return null;
  if (Date.parse(data.expires_at as string) < Date.now()) return null;

  return {
    tenantId: data.tenant_id as string,
    codeVerifier: data.code_verifier as string,
  };
}

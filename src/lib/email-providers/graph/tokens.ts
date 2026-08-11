import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptProviderCredentials } from "../encrypt";
import { refreshAccessToken } from "./oauth";
import { failEmailProvider } from "../alert";
import type { OAuthCredentials } from "@/lib/email/transport/types";

/** Refresh the access token when it is within this window of expiring. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

/**
 * Thrown when the stored refresh token no longer works (revoked, expired,
 * password change, consent withdrawn). This is the "silent expiry" case — the
 * connection is dead and needs a human to reconnect. Callers mark the provider
 * status='error' and alert the agency.
 */
export class GraphAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphAuthError";
  }
}

/**
 * Return a currently-valid Graph access token for a tenant, refreshing and
 * persisting the rotated token set when needed. On refresh failure the provider
 * row is flipped to status='error' with last_error, so a dead connection
 * surfaces in the UI and to the health check instead of failing silently.
 */
export async function getValidGraphAccessToken(
  tenantId: string,
  creds: OAuthCredentials,
): Promise<string> {
  const expiresAt = Date.parse(creds.expiry) || 0;
  if (expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return creds.accessToken;
  }

  let next;
  try {
    next = await refreshAccessToken(creds.refreshToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failEmailProvider(tenantId, `Token refresh failed: ${message}`);
    throw new GraphAuthError(message);
  }

  const admin = createSupabaseAdminClient();
  await admin
    .from("email_providers")
    .update({
      credentials: encryptProviderCredentials(
        JSON.stringify({
          accessToken: next.accessToken,
          refreshToken: next.refreshToken,
          expiry: next.expiry,
        } satisfies OAuthCredentials),
      ),
      status: "active",
      last_error: null,
      verified_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  return next.accessToken;
}

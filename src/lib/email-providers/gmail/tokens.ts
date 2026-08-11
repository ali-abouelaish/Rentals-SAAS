import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptProviderCredentials } from "../encrypt";
import { failEmailProvider } from "../alert";
import { refreshAccessToken } from "./oauth";
import type { OAuthCredentials } from "@/lib/email/transport/types";

const REFRESH_SKEW_MS = 5 * 60 * 1000;

/** Thrown when the stored Gmail refresh token no longer works (revoked/expired). */
export class GmailAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GmailAuthError";
  }
}

/**
 * Return a valid Gmail access token, refreshing and persisting when needed. On
 * refresh failure the provider is flagged (status='error' + alert) and a
 * GmailAuthError is thrown.
 */
export async function getValidGmailAccessToken(
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
    throw new GmailAuthError(message);
  }

  const admin = createSupabaseAdminClient();
  await admin
    .from("email_providers")
    .update({
      credentials: encryptProviderCredentials(
        JSON.stringify({
          accessToken: next.accessToken,
          // Google omits the refresh token on refresh — keep the existing one.
          refreshToken: next.refreshToken || creds.refreshToken,
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

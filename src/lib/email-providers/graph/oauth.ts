// Microsoft identity platform (Azure AD) OAuth for the Graph email transport.
// Delegated auth-code + PKCE flow: an agency admin signs into their own
// Microsoft 365 mailbox and consents to Mail.Send, and we store the resulting
// refresh token (encrypted) to send mail on their behalf.

const AUTH_HOST = "https://login.microsoftonline.com";

/** Delegated scopes. offline_access ⇒ refresh token; User.Read ⇒ read the mailbox address. */
export const GRAPH_SCOPES = [
  "offline_access",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/User.Read",
];

export type GraphOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Azure AD authority segment: a specific tenant id, or "common"/"organizations". */
  authority: string;
};

export function graphOAuthConfig(): GraphOAuthConfig {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Microsoft OAuth env vars: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI",
    );
  }
  // Single-tenant apps must authorize against their own tenant id; multi-tenant
  // apps use "common". Default to common and let single-tenant deployments override.
  const authority = process.env.MICROSOFT_TENANT_ID || "common";
  return { clientId, clientSecret, redirectUri, authority };
}

export function buildAuthorizeUrl({
  state,
  codeChallenge,
}: {
  state: string;
  codeChallenge: string;
}): string {
  const { clientId, redirectUri, authority } = graphOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: GRAPH_SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    // Force an account picker + consent so admins can pick the right mailbox.
    prompt: "select_account",
  });
  return `${AUTH_HOST}/${authority}/oauth2/v2.0/authorize?${params.toString()}`;
}

export type GraphTokenSet = {
  accessToken: string;
  /** Microsoft may rotate the refresh token; callers must persist whatever comes back. */
  refreshToken: string;
  /** ISO timestamp of access-token expiry. */
  expiry: string;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<GraphTokenSet> {
  const { authority } = graphOAuthConfig();
  const res = await fetch(`${AUTH_HOST}/${authority}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !json.access_token) {
    const detail = json.error_description || json.error || `HTTP ${res.status}`;
    throw new Error(`Microsoft token request failed: ${detail}`);
  }
  return {
    accessToken: json.access_token,
    // On refresh, MS usually returns a new refresh token; fall back to the one we sent.
    refreshToken: json.refresh_token ?? body.refresh_token ?? "",
    expiry: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(),
  };
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<GraphTokenSet> {
  const { clientId, clientSecret, redirectUri } = graphOAuthConfig();
  const tokens = await tokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    scope: GRAPH_SCOPES.join(" "),
  });
  if (!tokens.refreshToken) {
    throw new Error("Microsoft did not return a refresh token. Ensure offline_access is consented.");
  }
  return tokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<GraphTokenSet> {
  const { clientId, clientSecret } = graphOAuthConfig();
  return tokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: GRAPH_SCOPES.join(" "),
  });
}

/** Read the signed-in mailbox address via Graph /me (userPrincipalName as fallback). */
export async function fetchMailboxAddress(accessToken: string): Promise<string> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Graph /me failed (${res.status}): ${detail}`);
  }
  const json = (await res.json()) as { mail?: string; userPrincipalName?: string };
  const address = json.mail || json.userPrincipalName;
  if (!address) throw new Error("Graph /me returned no mailbox address");
  return address;
}

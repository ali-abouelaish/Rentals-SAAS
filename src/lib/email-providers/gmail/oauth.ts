// Google OAuth for the Gmail email transport (send-only). Separate from the
// leads inbound integration (src/lib/gmail/*, gmail.readonly, its own redirect
// + tenant_gmail_connections table): this flow uses gmail.send and writes to
// email_providers. Reuses the same Google client id/secret but a distinct
// redirect URI (GOOGLE_SEND_REDIRECT_URI), which must be registered on the
// OAuth client alongside the leads one.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export const GMAIL_SEND_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.send",
];

export type GmailOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function gmailOAuthConfig(): GmailOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_SEND_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Google OAuth env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_SEND_REDIRECT_URI",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildAuthorizeUrl({
  state,
  codeChallenge,
}: {
  state: string;
  codeChallenge: string;
}): string {
  const { clientId, redirectUri } = gmailOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: GMAIL_SEND_SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    // offline + consent are required to receive a refresh token.
    access_type: "offline",
    prompt: "consent",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type GmailTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiry: string;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<GmailTokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !json.access_token) {
    const detail = json.error_description || json.error || `HTTP ${res.status}`;
    throw new Error(`Google token request failed: ${detail}`);
  }
  return {
    accessToken: json.access_token,
    // Google only returns a refresh token on first consent; reuse the one we sent on refresh.
    refreshToken: json.refresh_token ?? body.refresh_token ?? "",
    expiry: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(),
  };
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<GmailTokenSet> {
  const { clientId, clientSecret, redirectUri } = gmailOAuthConfig();
  const tokens = await tokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });
  if (!tokens.refreshToken) {
    throw new Error("Google did not return a refresh token. Remove prior access and re-consent (offline access).");
  }
  return tokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<GmailTokenSet> {
  const { clientId, clientSecret } = gmailOAuthConfig();
  return tokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

/** Read the signed-in Gmail address (userinfo.email scope). */
export async function fetchEmailAddress(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google userinfo failed (${res.status}): ${detail}`);
  }
  const json = (await res.json()) as { email?: string };
  if (!json.email) throw new Error("Google userinfo returned no email address");
  return json.email;
}

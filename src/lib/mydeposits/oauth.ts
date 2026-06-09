// mydeposits OAuth (authorization code + PKCE). Generic IdentityServer-style
// provider, so we drive the flow directly with fetch (the Gmail integration's
// googleapis client can't be reused here).

import { mdOAuthConfig, mdUrls, type MdEnvironment } from "./config";

export type MdTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiry: Date;
};

type MdTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

/** Build the /connect/authorize URL the admin is redirected to. */
/**
 * Scopes requested at authorize time. Overridable via MYDEPOSITS_SCOPES so the
 * grant can be tuned without a code change — the sandbox IdentityServer exposes
 * per-service API scopes (RS.* deposits, TS.* releases, SpS.* lookups, PS.*
 * payments) and the client registration decides which we're allowed to request.
 */
function requestedScopes(): string {
  return process.env.MYDEPOSITS_SCOPES || "openid profile offline_access";
}

export function buildAuthorizeUrl(
  env: MdEnvironment,
  opts: { state: string; codeChallenge: string; redirectUri: string }
): string {
  const { clientId } = mdOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: opts.redirectUri,
    scope: requestedScopes(),
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  });
  // Interactive flow for this provider: send the admin to the auth host's login
  // SPA with the authorize request as `returnUrl`. The SPA authenticates (email
  // magic-link / SMS code; sandbox OTP 1111), establishes the IdentityServer
  // session, then replays returnUrl so /connect/authorize 302s back to our
  // redirect_uri with ?code=...&state=...  Hitting /connect/authorize directly
  // returns an empty 200 — it never redirects to a login page on its own.
  //
  // ⚠ BROKEN UPSTREAM (confirmed 2026-06-09, mydeposits SANDBOX): this exact
  // redirect rendered a working login form ~2 days prior, but the auth host's
  // /login now returns a blank SPA shell and /connect/authorize returns empty 200
  // even WITH a valid idsrv session. A recent server-side regression on their
  // side — no code change here can work around it. Escalated to mydeposits.
  // See memory: project_mydeposits_sandbox_auth.
  const authorizePath = `/connect/authorize?${params.toString()}`;
  return `${mdUrls(env).authBase}/login?returnUrl=${encodeURIComponent(authorizePath)}`;
}

async function postToken(env: MdEnvironment, body: URLSearchParams): Promise<MdTokenSet> {
  const { clientId, clientSecret } = mdOAuthConfig();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  const res = await fetch(`${mdUrls(env).authBase}/connect/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const text = await res.text();
  let parsed: MdTokenResponse = {};
  try {
    parsed = text ? (JSON.parse(text) as MdTokenResponse) : {};
  } catch {
    // fall through to the !ok / missing-token errors below
  }

  if (!res.ok || parsed.error) {
    const detail = parsed.error_description || parsed.error || text.slice(0, 300);
    throw new Error(`mydeposits token endpoint ${res.status}: ${detail}`);
  }
  if (!parsed.access_token || !parsed.refresh_token) {
    throw new Error("mydeposits token response missing access_token or refresh_token.");
  }

  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    expiry: new Date(Date.now() + (parsed.expires_in ?? 3600) * 1000),
  };
}

export function exchangeCode(
  env: MdEnvironment,
  opts: { code: string; codeVerifier: string; redirectUri: string }
): Promise<MdTokenSet> {
  return postToken(
    env,
    new URLSearchParams({
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
      code_verifier: opts.codeVerifier,
    })
  );
}

export function refreshTokens(env: MdEnvironment, refreshToken: string): Promise<MdTokenSet> {
  return postToken(
    env,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
}

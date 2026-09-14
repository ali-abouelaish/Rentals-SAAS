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

/**
 * Scopes sent on the authorize request.
 *
 * ⚠ LEAVE MYDEPOSITS_SCOPES UNSET. Total Property's IdentityServer rejects an
 * explicit `scope` parameter on this client: sending ANY value — even a bare
 * `openid` — makes /connect/authorize return an empty 200 instead of the 302
 * to the login page. That empty 200 is the "blank page" this integration
 * dead-ended on for months. Proven live 2026-08-20:
 *
 *   no scope param                     -> 302 /login?returnUrl=...   ✅
 *   scope=openid                       -> 200, 0-byte body           ❌
 *   scope=openid profile offline_access-> 200, 0-byte body           ❌
 *   scope=RS.Ext                       -> 200, 0-byte body           ❌
 *
 * With the parameter omitted the server substitutes the client's own
 * registered scope list, which is everything we need (confirmed in the issued
 * token): TS.Ext SpS.Ext RS.Ext NS.Ext SM.Ext ALS.Ext FS.Ext IS.Ext PS.Ext
 * IdentityServerApi openid profile offline_access.
 *
 * The env var stays as an escape hatch in case they ever fix the client so an
 * explicit (narrower) grant becomes possible.
 */
function requestedScopes(): string | null {
  return process.env.MYDEPOSITS_SCOPES?.trim() || null;
}

/** Build the /connect/authorize URL the admin is redirected to. */
export function buildAuthorizeUrl(
  env: MdEnvironment,
  opts: { state: string; codeChallenge: string; redirectUri: string }
): string {
  const { clientId } = mdOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: opts.redirectUri,
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  });
  // Deliberately conditional and normally absent — see requestedScopes().
  const scope = requestedScopes();
  if (scope) params.set("scope", scope);

  // Hit /connect/authorize directly. It 302s to the auth host's login SPA on
  // its own and carries the request through login -> consent -> back to our
  // redirect_uri with ?code=&state=. The previous `/login?returnUrl=<authorize>`
  // wrapper is unnecessary (and isn't what their docs describe); the blank page
  // it appeared to cause was really the `scope` parameter above.
  return `${mdUrls(env).authBase}/connect/authorize?${params.toString()}`;
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

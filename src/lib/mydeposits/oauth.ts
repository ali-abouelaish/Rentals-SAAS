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
export function buildAuthorizeUrl(
  env: MdEnvironment,
  opts: { state: string; codeChallenge: string; redirectUri: string }
): string {
  const { clientId } = mdOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: opts.redirectUri,
    scope: "openid profile offline_access",
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  });
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

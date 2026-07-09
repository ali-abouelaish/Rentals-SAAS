// Headless "Login" (Consumer) auth flow for mydeposits / Total Property.
//
// The documented alternative (mydeposits.txt:99-129) to the browser
// authorization-code redirect in ./oauth.ts, which currently dead-ends on a
// blank /connect/authorize page (see project_mydeposits_sandbox_auth memory).
// The flow:
//
//   1. getLoginOptions(email)                    GET  /api/v1/ui/login-options
//   2. requestLoginCode({email, authMethod})     POST /api/v1/ui/request-login-code
//   3. headlessLogin({email, authMethod, secret}) POST /api/v1/ui/login   (sets the idsrv session cookie)
//        SMS(2): body { code }   Email(1): body { token: <magic-link GUID> }
//   4. codeFromSession(cookies) -> exchangeCode(...)  POST authorize [-> consent] -> code -> token
//
// Steps 1-3 are CONFIRMED live against sandbox. Step 4 was reverse-engineered
// from the login SPA bundle and confirmed up to the consent step: authorize must
// be POSTed (GET dead-ends on empty 200), it 302s to /consent, consent is granted
// with PUT /api/v1/ui/consent. The chain is currently BLOCKED upstream by a
// client-config bug (consent required but empty scope list; grant not honoured →
// /consent loop). See codeFromSession + project_mydeposits_sandbox_auth.
//
// Gated behind MYDEPOSITS_AUTH_MODE=headless — nothing calls this until the
// connect route/UI opt in.

import { mdUrls, mdOAuthConfig, type MdEnvironment } from "./config";
import { generateCodeVerifier, challengeFromVerifier, randomState } from "./pkce";
import { exchangeCode, type MdTokenSet } from "./oauth";

/** AuthMethodEnum from the Auth API: 1 = Email, 2 = SMS (0/3/4 are out of range). */
export const MD_AUTH_METHOD = { email: 1, sms: 2 } as const;
export type MdAuthMethod = (typeof MD_AUTH_METHOD)[keyof typeof MD_AUTH_METHOD];

const UI = "/api/v1/ui";
const scopes = () => process.env.MYDEPOSITS_SCOPES || "openid profile offline_access";

async function readJson(res: Response, label: string): Promise<unknown> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`mydeposits ${label} ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

/** Step 1 — which auth methods (email/SMS) the account supports. */
export async function getLoginOptions(env: MdEnvironment, email: string): Promise<unknown> {
  const res = await fetch(
    `${mdUrls(env).authBase}${UI}/login-options?email=${encodeURIComponent(email)}`,
    { headers: { Accept: "application/json" } }
  );
  return readJson(res, "login-options");
}

/** Step 2 — trigger the login token (email magic-link GUID, or SMS code; sandbox OTP 1111). */
export async function requestLoginCode(
  env: MdEnvironment,
  opts: { email: string; authMethod: MdAuthMethod }
): Promise<void> {
  const res = await fetch(`${mdUrls(env).authBase}${UI}/request-login-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(opts),
  });
  await readJson(res, "request-login-code");
}

export type MdSession = {
  /** "Account data" body (accounts, isAccountSelectionRequired, ...). */
  account: unknown;
  /** Cookie header (idsrv session) to replay against /connect/authorize. */
  cookies: string;
};

/**
 * Step 3 — exchange the login token for an authenticated session. Captures the
 * idsrv session cookie(s), which must be replayed on the SAME host (auth.*) as
 * /connect/authorize.
 */
export async function headlessLogin(
  env: MdEnvironment,
  opts: { email: string; authMethod: MdAuthMethod; secret: string; returnUrl?: string }
): Promise<MdSession> {
  // Body shape differs by method (reverse-engineered from the login SPA bundle,
  // confirmed live): SMS submits { code } (the OTP, sandbox 1111); Email submits
  // { token } (the magic-link GUID). The endpoint rejects an OTP sent as `token`
  // ("could not be converted to System.Nullable[System.Guid]").
  const credential =
    opts.authMethod === MD_AUTH_METHOD.sms
      ? { code: opts.secret }
      : { token: opts.secret };
  const res = await fetch(`${mdUrls(env).authBase}${UI}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      authMethod: opts.authMethod,
      email: opts.email,
      ...credential,
      returnUrl: opts.returnUrl,
    }),
    redirect: "manual",
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const cookies = setCookies.map((c) => c.split(";")[0]).join("; ");
  const account = await readJson(res, "ui/login");
  if (!cookies) throw new Error("mydeposits ui/login returned no session cookie");
  return { account, cookies };
}

/**
 * Step 4 — drive the authenticated authorize interaction to a code. Reverse-
 * engineered + confirmed live against sandbox:
 *   - authorize must be POSTed (a GET dead-ends on an empty 200 upstream); it
 *     302s into the interaction chain.
 *   - the chain may pass through /consent, which is granted out-of-band with
 *     PUT /api/v1/ui/consent { deny:false, returnUrl } → { validReturnUrl }.
 *   - we follow the chain (max hops) until a Location carries ?code=.
 *
 * ⚠ As of this writing the sandbox client is misconfigured: it REQUIRES consent
 * but the consent screen returns an empty scope list, and granting it is not
 * honoured by /connect/authorize/callback — the chain loops back to /consent
 * forever. That is a mydeposits-side client-config problem, surfaced here as the
 * "consent loop" error. No request shape breaks it; it needs RequireConsent=false
 * (or a fixed consent config) on their client. See project_mydeposits_sandbox_auth.
 */
const MAX_AUTHZ_HOPS = 6;

async function codeFromSession(
  env: MdEnvironment,
  cookies: string,
  redirectUri: string
): Promise<{ code: string; codeVerifier: string }> {
  const { clientId } = mdOAuthConfig();
  const authBase = mdUrls(env).authBase;
  const codeVerifier = generateCodeVerifier();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes(),
    state: randomState(),
    code_challenge: challengeFromVerifier(codeVerifier),
    code_challenge_method: "S256",
  });

  let res = await fetch(`${authBase}/connect/authorize`, {
    method: "POST",
    headers: {
      Cookie: cookies,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html",
    },
    body: params.toString(),
    redirect: "manual",
  });

  let consentGrants = 0;
  for (let hop = 0; hop < MAX_AUTHZ_HOPS; hop++) {
    const location = res.headers.get("location");
    if (!location) {
      throw new Error(`authorize hop ${hop} did not redirect (HTTP ${res.status}).`);
    }
    const target = new URL(location, authBase);

    const code = target.searchParams.get("code");
    if (code) return { code, codeVerifier };

    if (target.pathname.startsWith("/consent")) {
      // Being sent back to /consent after already granting = the known upstream
      // loop (consent required but grant not honoured). Fail fast with a clear cause.
      if (consentGrants >= 1) {
        throw new Error("consent loop — grant not honoured by authorize (mydeposits client-config issue).");
      }
      const returnUrl = target.searchParams.get("returnUrl");
      const grant = await fetch(`${authBase}${UI}/consent`, {
        method: "PUT",
        headers: { Cookie: cookies, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ deny: false, rememberConsent: true, returnUrl }),
      });
      const grantJson = (await grant.json().catch(() => ({}))) as { validReturnUrl?: string };
      if (!grantJson.validReturnUrl) {
        throw new Error(
          `consent grant failed (HTTP ${grant.status}) — likely the client requires consent but the ` +
            `scope list is empty (mydeposits client-config issue). See project_mydeposits_sandbox_auth.`
        );
      }
      consentGrants++;
      res = await fetch(new URL(grantJson.validReturnUrl, authBase), {
        headers: { Cookie: cookies, Accept: "text/html" },
        redirect: "manual",
      });
      continue;
    }

    // Any other in-flow hop (e.g. /connect/authorize/callback) — follow it.
    res = await fetch(target, { headers: { Cookie: cookies, Accept: "text/html" }, redirect: "manual" });
  }

  throw new Error(`authorize did not yield a code within ${MAX_AUTHZ_HOPS} hops (consent loop / upstream).`);
}

/**
 * Full headless connect: login secret -> session -> code -> tokens.
 * `secret` is the SMS OTP (authMethod 2) or the email magic-link GUID (method 1).
 * The final leg reuses ./oauth.ts exchangeCode (authorization_code grant).
 */
export async function connectHeadless(
  env: MdEnvironment,
  opts: { email: string; authMethod: MdAuthMethod; secret: string }
): Promise<MdTokenSet> {
  const { redirectUri } = mdOAuthConfig();
  const { cookies } = await headlessLogin(env, { ...opts, returnUrl: redirectUri });
  const { code, codeVerifier } = await codeFromSession(env, cookies, redirectUri);
  return exchangeCode(env, { code, codeVerifier, redirectUri });
}

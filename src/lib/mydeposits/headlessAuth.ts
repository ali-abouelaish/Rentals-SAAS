// Headless "Login" (Consumer) auth flow for mydeposits / Total Property.
//
// The documented alternative (mydeposits.txt:99-129) to the browser
// authorization-code redirect in ./oauth.ts, which currently dead-ends on a
// blank /connect/authorize page (see project_mydeposits_sandbox_auth memory).
// The flow:
//
//   1. getLoginOptions(email)                 GET  /api/v1/ui/login-options
//   2. requestLoginCode({email, authMethod})  POST /api/v1/ui/request-login-code  (emails/SMSes a token)
//   3. headlessLogin({email, authMethod, token}) POST /api/v1/ui/login            (sets the idsrv session cookie)
//   4. codeFromSession(cookies) -> exchangeCode(...)  authenticated authorize + token
//
// Steps 1-3 are CONFIRMED live against sandbox (structured JSON, not the gateway
// blank). Step 4's exact contract is the open upstream question: we take the
// most-likely path — replay the idsrv cookie against /connect/authorize+PKCE to
// obtain a code, then reuse ./oauth.ts exchangeCode. Verify with
// `scripts/mydeposits-headless-login.mjs` before relying on it; the final
// /connect/token grant may differ (mydeposits.txt:1855 hints PKCE).
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
  opts: { email: string; authMethod: MdAuthMethod; token: string; returnUrl?: string }
): Promise<MdSession> {
  const res = await fetch(`${mdUrls(env).authBase}${UI}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(opts),
    redirect: "manual",
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const cookies = setCookies.map((c) => c.split(";")[0]).join("; ");
  const account = await readJson(res, "ui/login");
  if (!cookies) throw new Error("mydeposits ui/login returned no session cookie");
  return { account, cookies };
}

/**
 * Step 4a — replay the authenticated session against /connect/authorize (PKCE)
 * and pull the `code` out of the 302 to redirect_uri. Throws if authorize does
 * not 302 with a code (blank 200 / error), which is itself the diagnostic that
 * the browser-redirect assumption fails even with a valid session.
 */
async function codeFromSession(
  env: MdEnvironment,
  cookies: string,
  redirectUri: string
): Promise<{ code: string; codeVerifier: string }> {
  const { clientId } = mdOAuthConfig();
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
  const res = await fetch(`${mdUrls(env).authBase}/connect/authorize?${params.toString()}`, {
    headers: { Cookie: cookies, Accept: "text/html" },
    redirect: "manual",
  });
  const location = res.headers.get("location");
  const code = location ? new URL(location, mdUrls(env).authBase).searchParams.get("code") : null;
  if (!code) {
    throw new Error(
      `authenticated /connect/authorize did not return a code (HTTP ${res.status}, location=${location ?? "none"})`
    );
  }
  return { code, codeVerifier };
}

/**
 * Full headless connect: login token -> session -> code -> tokens.
 * The final leg reuses ./oauth.ts exchangeCode (authorization_code grant).
 */
export async function connectHeadless(
  env: MdEnvironment,
  opts: { email: string; authMethod: MdAuthMethod; token: string }
): Promise<MdTokenSet> {
  const { redirectUri } = mdOAuthConfig();
  const { cookies } = await headlessLogin(env, { ...opts, returnUrl: redirectUri });
  const { code, codeVerifier } = await codeFromSession(env, cookies, redirectUri);
  return exchangeCode(env, { code, codeVerifier, redirectUri });
}

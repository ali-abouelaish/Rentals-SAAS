// Runnable probe for the mydeposits / Total Property HEADLESS "Login" (Consumer)
// auth flow — the documented alternative (mydeposits.txt:99-129) to the browser
// authorization-code redirect that currently dead-ends on a blank
// /connect/authorize page. See the project_mydeposits_sandbox_auth memory and
// src/lib/mydeposits/oauth.ts for background.
//
// The login token arrives async (email/SMS), so this runs in two steps:
//
//   node --env-file=.env.local scripts/mydeposits-headless-login.mjs request <email> [authMethod]
//   node --env-file=.env.local scripts/mydeposits-headless-login.mjs login   <email> <token> [authMethod]
//
//   authMethod: 1 = Email (token = the GUID in the emailed magic link
//               auth.sandbox/login?token=<GUID>&email=), 2 = SMS (token = the
//               SMS code; sandbox OTP is always 1111). Default 1.
//
// The `login` step also PROBES the open question — what the final /connect/token
// grant is — by replaying the idsrv session cookie against /connect/authorize+PKCE
// and printing the exact status + Location. That one response reveals whether
// (a) our redirect_uri is registered and (b) an authenticated authorize yields a
// code. Nothing here touches the app; it is a diagnostic only.

import { createHash, randomBytes } from "node:crypto";

const ENV = process.env.MYDEPOSITS_ENV === "production" ? "production" : "sandbox";
const AUTH_BASE =
  ENV === "production"
    ? "https://auth.totalproperty.co.uk"
    : "https://auth.sandbox.totalproperty.co.uk";

const CLIENT_ID = process.env.MYDEPOSITS_CLIENT_ID;
const CLIENT_SECRET = process.env.MYDEPOSITS_CLIENT_SECRET;
const REDIRECT_URI = process.env.MYDEPOSITS_REDIRECT_URI;
const SCOPES = process.env.MYDEPOSITS_SCOPES || "openid profile offline_access";

const b64url = (buf) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const codeVerifier = () => b64url(randomBytes(32));
const codeChallenge = (v) => b64url(createHash("sha256").update(v).digest());

function hr(label) {
  console.log(`\n===== ${label} =====`);
}

async function dump(label, res) {
  const body = await res.text();
  console.log(`${label} -> HTTP ${res.status} (${body.length}b)`);
  if (body) {
    try {
      console.log(JSON.stringify(JSON.parse(body), null, 2));
    } catch {
      console.log(body.slice(0, 600));
    }
  }
  return body;
}

async function requestCode(email, authMethod) {
  hr("1) login-options (which auth methods does this account have?)");
  const opts = await fetch(
    `${AUTH_BASE}/api/v1/ui/login-options?email=${encodeURIComponent(email)}`,
    { headers: { Accept: "application/json" } }
  );
  await dump("GET /api/v1/ui/login-options", opts);

  hr(`2) request-login-code (authMethod=${authMethod})`);
  const req = await fetch(`${AUTH_BASE}/api/v1/ui/request-login-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, authMethod }),
  });
  await dump("POST /api/v1/ui/request-login-code", req);

  console.log(
    `\nNow check ${authMethod === 2 ? "your phone (SMS)" : "the account inbox"} for the login ` +
      `${authMethod === 2 ? "code (sandbox: 1111)" : "link (token = the GUID after ?token=)"}, then run:\n` +
      `  node --env-file=.env.local scripts/mydeposits-headless-login.mjs login ${email} <token> ${authMethod}`
  );
}

async function login(email, secret, authMethod) {
  hr("3) ui/login (exchange the login secret for an authenticated session)");
  // SMS(2) submits { code }; Email(1) submits { token: <magic-link GUID> }.
  const credential = Number(authMethod) === 2 ? { code: secret } : { token: secret };
  const res = await fetch(`${AUTH_BASE}/api/v1/ui/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ authMethod, email, ...credential, returnUrl: REDIRECT_URI }),
    redirect: "manual",
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const cookieHeader = setCookies.map((c) => c.split(";")[0]).join("; ");
  await dump("POST /api/v1/ui/login", res);
  console.log("Set-Cookie names:", setCookies.map((c) => c.split("=")[0]).join(", ") || "(none)");
  if (!cookieHeader) {
    console.log("\nNo session cookie returned — cannot probe the token exchange. Stop here.");
    return;
  }

  hr("4) PROBE: authenticated authorize interaction (POST authorize -> consent -> code)");
  const verifier = codeVerifier();
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state: b64url(randomBytes(16)),
    code_challenge: codeChallenge(verifier),
    code_challenge_method: "S256",
  });
  // authorize is POSTed (GET dead-ends on an empty 200 upstream); follow the
  // interaction chain, granting consent (PUT /api/v1/ui/consent) when asked.
  let res2 = await fetch(`${AUTH_BASE}/connect/authorize`, {
    method: "POST",
    headers: { Cookie: cookieHeader, "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html" },
    body: params.toString(),
    redirect: "manual",
  });
  let code = null;
  let consentGrants = 0;
  for (let hop = 0; hop < 6 && !code; hop++) {
    const location = res2.headers.get("location");
    console.log(`  hop ${hop}: HTTP ${res2.status} -> ${location ?? "(no location)"}`);
    if (!location) break;
    const target = new URL(location, AUTH_BASE);
    code = target.searchParams.get("code");
    if (code) break;
    if (target.pathname.startsWith("/consent")) {
      if (consentGrants >= 1) {
        console.log("\n❌ CONSENT LOOP — consent granted but not honoured by authorize. Upstream client-config\n" +
          "   bug (RequireConsent=true but empty scope list). Raise with mydeposits — see message below.");
        break;
      }
      const returnUrl = target.searchParams.get("returnUrl");
      const grant = await fetch(`${AUTH_BASE}/api/v1/ui/consent`, {
        method: "PUT",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ deny: false, rememberConsent: true, returnUrl }),
      });
      const gj = await grant.json().catch(() => ({}));
      console.log(`         consent PUT -> HTTP ${grant.status}, validReturnUrl=${gj.validReturnUrl ?? "(none)"}`);
      if (!gj.validReturnUrl) break;
      consentGrants++;
      res2 = await fetch(new URL(gj.validReturnUrl, AUTH_BASE), { headers: { Cookie: cookieHeader, Accept: "text/html" }, redirect: "manual" });
      continue;
    }
    res2 = await fetch(target, { headers: { Cookie: cookieHeader, Accept: "text/html" }, redirect: "manual" });
  }
  if (!code) {
    console.log("\nNo authorization code obtained — token exchange cannot proceed via this path.");
    return;
  }
  console.log(`\n✅ Got authorization code: ${code.slice(0, 14)}...`);

  hr("5) /connect/token (authorization_code grant)");
  const tok = await fetch(`${AUTH_BASE}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }).toString(),
  });
  const body = await dump("POST /connect/token", tok);
  if (tok.ok) {
    try {
      const j = JSON.parse(body);
      if (j.access_token && j.refresh_token) {
        console.log("\n✅ SUCCESS — headless flow yields OAuth tokens. Wire MYDEPOSITS_AUTH_MODE=headless.");
      }
    } catch {
      /* already dumped */
    }
  }
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    console.error("Missing env: MYDEPOSITS_CLIENT_ID, MYDEPOSITS_CLIENT_SECRET, MYDEPOSITS_REDIRECT_URI");
    process.exit(1);
  }
  const [cmd, email, arg3, arg4] = process.argv.slice(2);
  console.log(`env=${ENV} authBase=${AUTH_BASE} client=${CLIENT_ID}`);

  if (cmd === "request" && email) {
    return requestCode(email, Number(arg3) || 1);
  }
  if (cmd === "login" && email && arg3) {
    return login(email, arg3, Number(arg4) || 1);
  }
  console.error(
    "Usage:\n" +
      "  mydeposits-headless-login.mjs request <email> [authMethod]\n" +
      "  mydeposits-headless-login.mjs login   <email> <token> [authMethod]"
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("Failed:", err?.message || err);
  process.exit(1);
});

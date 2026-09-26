// Reproduction + narrowing probe for the mydeposits (Total Property) sandbox
// fault: POST /rs/api/v1/tenancies returns HTTP 500 with an empty body.
//
//   node --env-file=.env.local scripts/mydeposits-tenancy-probe.mjs [email] [otp]
//
// Defaults to the sandbox test account (SMS authMethod 2, OTP 1111). Drives the
// headless login to an idsrv session, exchanges it for a real bearer token via
// /connect/authorize (NO `scope` param — an explicit scope makes authorize
// return an empty 200), then runs the matrix that isolates the fault:
//
//   * auth works          bad token -> 401, good token -> 200 on every read
//   * binding works       POST {} -> 400 naming CreateTenancy+Request
//   * data is irrelevant  a non-existent propertyId also 500s (expect 404)
//   * narrow blast radius tenancies/name/validate (also a POST) -> 200
//
// Diagnostic only — the only writes it attempts are the tenancy creates that
// fail. Re-run when mydeposits report a fix. Last run 2026-09-15: still 500.

import { createHash, randomBytes } from "node:crypto";

const AUTH_BASE = "https://auth.sandbox.totalproperty.co.uk";
const API_BASE = "https://api.sandbox.totalproperty.co.uk/totalproperty";
const CLIENT_ID = process.env.MYDEPOSITS_CLIENT_ID;
const CLIENT_SECRET = process.env.MYDEPOSITS_CLIENT_SECRET;
const REDIRECT_URI = process.env.MYDEPOSITS_REDIRECT_URI;
const EMAIL = process.argv[2] || "ali.abouel3aish@gmail.com";
const OTP = process.argv[3] || "1111";
const PROPERTY_ID = 10007064;

const b64url = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const verifier = b64url(randomBytes(32));
const challenge = b64url(createHash("sha256").update(verifier).digest());

async function show(label, res) {
  const text = await res.text();
  console.log(`\n--- ${label}`);
  console.log(`HTTP ${res.status} (${text.length}b) at ${res.headers.get("date")}`);
  if (text) console.log(text.slice(0, 600));
  return { status: res.status, text };
}

async function login() {
  const attempt = () =>
    fetch(`${AUTH_BASE}/api/v1/ui/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ authMethod: 2, email: EMAIL, code: OTP, returnUrl: REDIRECT_URI }),
      redirect: "manual",
    });

  let res = await attempt();
  if (res.status >= 400) {
    // No pending code — request one (the sandbox always accepts 1111) and retry.
    await fetch(`${AUTH_BASE}/api/v1/ui/request-login-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, authMethod: 2 }),
    });
    res = await attempt();
  }

  const cookies = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  if (!cookies) throw new Error(`login ${res.status}: no session cookie`);
  console.log(`login -> HTTP ${res.status}`);
  return cookies;
}

async function getToken(cookie) {
  const jar = new Map(cookie.split("; ").map((c) => [c.split("=")[0], c]));
  const cookieHeader = () => [...jar.values()].join("; ");
  const absorb = (res) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const kv = c.split(";")[0];
      jar.set(kv.split("=")[0], kv);
    }
  };

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    state: b64url(randomBytes(16)),
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  let res = await fetch(`${AUTH_BASE}/connect/authorize?${params}`, {
    headers: { Cookie: cookieHeader(), Accept: "text/html" },
    redirect: "manual",
  });
  absorb(res);

  let code = null;
  let consents = 0;
  for (let hop = 0; hop < 10 && !code; hop++) {
    const location = res.headers.get("location");
    if (!location) break;
    const target = new URL(location, AUTH_BASE);
    code = target.searchParams.get("code");
    if (code) break;

    if (target.pathname.startsWith("/consent")) {
      if (consents++ >= 2) throw new Error("consent loop");
      const returnUrl = target.searchParams.get("returnUrl");
      const info = await fetch(
        `${AUTH_BASE}/api/v1/ui/consent?returnUrl=${encodeURIComponent(returnUrl)}`,
        { headers: { Cookie: cookieHeader(), Accept: "application/json" } }
      );
      absorb(info);
      const offered = await info.json().catch(() => ({}));
      const grant = await fetch(`${AUTH_BASE}/api/v1/ui/consent`, {
        method: "PUT",
        headers: {
          Cookie: cookieHeader(),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          deny: false,
          rememberConsent: true,
          returnUrl,
          scopesConsented: offered.scopes ?? [],
        }),
      });
      absorb(grant);
      const granted = await grant.json().catch(() => ({}));
      if (!granted.validReturnUrl) throw new Error(`consent PUT ${grant.status}`);
      res = await fetch(new URL(granted.validReturnUrl, AUTH_BASE), {
        headers: { Cookie: cookieHeader(), Accept: "text/html" },
        redirect: "manual",
      });
      absorb(res);
      continue;
    }

    res = await fetch(target, { headers: { Cookie: cookieHeader() }, redirect: "manual" });
    absorb(res);
  }
  if (!code) throw new Error("no authorization code");

  const tok = await fetch(`${AUTH_BASE}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }).toString(),
  });
  const json = await tok.json();
  if (!json.access_token) throw new Error(`token ${tok.status}: ${JSON.stringify(json)}`);
  console.log(`token -> ok (scope: ${json.scope})`);
  return json.access_token;
}

async function api(token, label, method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return show(`${label}: ${method} ${path}`, res);
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    console.error("Missing MYDEPOSITS_CLIENT_ID / MYDEPOSITS_CLIENT_SECRET / MYDEPOSITS_REDIRECT_URI");
    process.exit(1);
  }

  const token = await getToken(await login());
  console.log(`\n===== PROBE @ ${new Date().toISOString()} =====`);

  // Controls: reads and auth are healthy.
  await api(token, "read deposits", "GET", "/rs/api/v1/deposits");
  await api(token, "read tenancies", "GET", "/rs/api/v1/tenancies");
  await api(token, "read property", "GET", `/rs/api/v1/properties/${PROPERTY_ID}`);

  const unauthorized = await fetch(`${API_BASE}/rs/api/v1/tenancies`, {
    method: "POST",
    headers: { Authorization: "Bearer not-a-real-token", "Content-Type": "application/json" },
    body: JSON.stringify({ propertyId: PROPERTY_ID, tenancyName: "bad-token" }),
  });
  await show("auth control (expect 401)", unauthorized);

  // Binding + field validation both run before the fault.
  await api(token, "binding control (expect 400)", "POST", "/rs/api/v1/tenancies", {});

  // The bug itself.
  const today = new Date().toISOString().slice(0, 10);
  const minimal = await api(token, "THE BUG — minimal tenancy", "POST", "/rs/api/v1/tenancies", {
    propertyId: PROPERTY_ID,
    tenancyName: `Probe ${today}`,
  });
  await api(token, "THE BUG — full tenancy", "POST", "/rs/api/v1/tenancies", {
    propertyId: PROPERTY_ID,
    tenancyName: `Probe full ${today}`,
    startDate: "2026-10-01T00:00:00Z",
    endDate: "2027-09-30T00:00:00Z",
    rent: 1250,
    rentFrequencyId: 2,
    tenants: [
      {
        firstName: "Probe",
        lastName: "Tenant",
        email: "probe.tenant@example.com",
        phone: "+447700900123",
        isLeadTenant: true,
      },
    ],
    interestedParties: [],
  });

  // A non-existent property 500s too — so the fault precedes the property lookup.
  await api(token, "non-existent property (expect 404, gets 500)", "POST", "/rs/api/v1/tenancies", {
    propertyId: 99999999,
    tenancyName: "ghost",
  });

  // Same module, same verb, works — the blast radius is two command handlers.
  await api(token, "sibling that works", "POST", "/rs/api/v1/tenancies/name/validate", {
    tenancyName: "probe",
    propertyId: PROPERTY_ID,
  });
  await api(token, "sibling that fails", "POST", "/rs/api/v1/tenants/can-be-invited-to-tenancy", {
    propertyId: PROPERTY_ID,
  });

  console.log(
    minimal.status === 500
      ? "\n❌ STILL BROKEN — POST /rs/api/v1/tenancies returns 500. Chase mydeposits."
      : `\n✅ CHANGED — minimal tenancy create now returns ${minimal.status}. Re-open the integration work.`
  );
}

main().catch((err) => {
  console.error("Failed:", err?.message || err);
  process.exit(1);
});

// Probe: can the idsrv SESSION COOKIE from the headless /api/v1/ui/login flow
// call the real mydeposits API directly (cookie-session auth via the gtw gateway),
// bypassing the broken OAuth /connect/authorize entirely? If any endpoint returns
// 200 with data, the headless login becomes a usable integration path.
//
//   node --env-file=.env.local scripts/mydeposits-cookie-api-probe.mjs <email> <token> [authMethod]
//
// token = the emailed magic-link GUID (see mydeposits-headless-login.mjs for the
// quoted-printable recovery note). authMethod 1 = Email (default).

const AUTH_BASE = "https://auth.sandbox.totalproperty.co.uk";
const email = process.argv[2];
const token = process.argv[3];
const authMethod = Number(process.argv[4]) || 1;

if (!email || !token) {
  console.error("Usage: mydeposits-cookie-api-probe.mjs <email> <token> [authMethod]");
  process.exit(1);
}

async function main() {
  console.log("=== ui/login (establish session) ===");
  const login = await fetch(`${AUTH_BASE}/api/v1/ui/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, authMethod, token }),
    redirect: "manual",
  });
  const setCookies = login.headers.getSetCookie?.() ?? [];
  const body = await login.text();
  console.log(`login -> HTTP ${login.status}`);
  if (!login.ok) {
    console.log(body.slice(0, 300));
    console.log("\nLogin failed (token likely stale/single-use). Get a fresh token and retry.");
    return;
  }
  const acct = JSON.parse(body);
  const accountId = acct.accounts?.[0]?.accountId;
  console.log(`logged in: ${acct.firstName} ${acct.lastName}, accountId=${accountId}`);
  // Print cookie attributes (domain/path) so we can see how they'd scope in a browser.
  console.log("Set-Cookie (raw attributes):");
  for (const c of setCookies) console.log("  " + c);
  const cookieHeader = setCookies.map((c) => c.split(";")[0]).join("; ");

  // Endpoint battery: both gateway hosts, with/without service prefixes, a few
  // read-only GETs from the docs (profile/accounts, deposits, dashboards).
  const GTW = "https://gtw.sandbox.totalproperty.co.uk";
  const API = "https://api.sandbox.totalproperty.co.uk/totalproperty";
  const paths = [
    "/sps/api/v1/profile/accounts",
    "/sps/api/v1/profile",
    "/rs/api/v1/deposits",
    "/rs/api/v1/dashboards/widgets",
    "/api/v1/profile/accounts",
    "/api/v1/deposits",
  ];
  const targets = [];
  for (const p of paths) targets.push(`${GTW}${p}`, `${API}${p}`);

  // Try cookie-only first; if everything 401s, retry the best candidate with
  // portal Origin/Referer + account header (BFF setups often gate on these).
  const baseHeaders = { Cookie: cookieHeader, Accept: "application/json" };
  const richHeaders = {
    ...baseHeaders,
    Origin: "https://portal.sandbox.totalproperty.co.uk",
    Referer: "https://portal.sandbox.totalproperty.co.uk/",
    "X-Requested-With": "XMLHttpRequest",
    ...(accountId ? { "Account-Id": String(accountId), accountId: String(accountId) } : {}),
  };

  async function hit(url, headers, tag) {
    try {
      const r = await fetch(url, { headers, redirect: "manual" });
      const t = await r.text();
      const loc = r.headers.get("location");
      console.log(
        `[${tag}] ${r.status} ${String(t.length).padStart(5)}b  ${url}` +
          (loc ? `\n         -> Location: ${loc}` : "") +
          (t && r.status !== 200 ? `\n         ${t.slice(0, 160).replace(/\s+/g, " ")}` : "") +
          (r.status === 200 && t ? `\n         ${t.slice(0, 200).replace(/\s+/g, " ")}` : "")
      );
      return r.status;
    } catch (e) {
      console.log(`[${tag}] ERR   ${url} -> ${e.message}`);
      return 0;
    }
  }

  console.log("\n=== cookie-only ===");
  const results = [];
  for (const url of targets) results.push([url, await hit(url, baseHeaders, "cookie")]);

  const candidate = results.find(([, s]) => s && s !== 404)?.[0] ?? targets[0];
  console.log("\n=== retry best candidate with portal Origin/Referer + account headers ===");
  await hit(candidate, richHeaders, "rich");

  const any200 = results.some(([, s]) => s === 200);
  console.log(
    "\n" +
      (any200
        ? "✅ Cookie-session reaches the API — headless login is a viable path."
        : "❌ No 200s — the idsrv cookie alone does not authenticate the API (likely needs a bearer token the portal mints server-side).")
  );
}

main().catch((e) => {
  console.error("Failed:", e?.message || e);
  process.exit(1);
});

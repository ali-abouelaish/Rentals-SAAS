// DPS UAT probe — settles the three documentation ambiguities before we build
// (see docs/dps-integration-plan.md §8, Q1–Q3):
//   Q3: which token endpoint exists (/v1.0/connect/token vs /oauth/token, which host)
//   Q2: which date format create accepts (ISO YYYY-MM-DD vs DD/MM/YYYY)
//   Q1: the exact JSON key of the deposit ID in the create success response
// Bonus (Q7): whether the mock deposit ID from create works against
// MarkForBankTransfer in UAT.
//
//   node --env-file=.env.local scripts/dps-uat-probe.mjs
//
// Requires in .env.local:
//   DPS_TEST_CLIENT_ID=...
//   DPS_TEST_CLIENT_SECRET=...          (the TEST secret, not live)
//   DPS_TEST_AGENT_LANDLORD_ID=1234567  (optional; 7-digit DPS account id —
//                                        falls back to a dummy, UAT is mock mode)
//
// UAT stores nothing (mock mode), so this is safe to run repeatedly.

const HOST = "https://api-uat.depositprotection.com";

const clientId = process.env.DPS_TEST_CLIENT_ID;
const clientSecret = process.env.DPS_TEST_CLIENT_SECRET;
const agentLandlordId = process.env.DPS_TEST_AGENT_LANDLORD_ID || "1234567";

if (!clientId || !clientSecret) {
  console.error("Set DPS_TEST_CLIENT_ID and DPS_TEST_CLIENT_SECRET in .env.local first.");
  process.exit(1);
}

// Empirical finding (2026-07-07): the design notes document Basic-header auth,
// but the UAT gateway's JWT middleware rejects any non-Bearer Authorization
// header (IDX12741). What actually works is client_secret_post — id + secret in
// the form body, no Authorization header — exactly what the Postman FAQ doc
// describes ("No Auth" + x-www-form-urlencoded body). Token comes back HTTP 201.
const tokenForm = new URLSearchParams({
  grant_type: "client_credentials",
  client_id: clientId,
  client_secret: clientSecret,
});

function redactToken(t) {
  if (typeof t !== "string") return t;
  return `${t.slice(0, 10)}…(${t.length} chars)`;
}

async function tryTokenEndpoint(path) {
  const url = `${HOST}${path}`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "application/json",
      },
      body: tokenForm.toString(),
    });
  } catch (err) {
    console.log(`  ${path} -> network error: ${err.message}`);
    return null;
  }
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  const reqId = res.headers.get("x-request-id") || res.headers.get("request-id") || "";
  console.log(`  ${path} -> HTTP ${res.status}${reqId ? ` (requestId ${reqId})` : ""}`);
  // UAT returns 201 (not 200) on token success.
  if (res.ok && body?.access_token) {
    console.log(
      `    access_token=${redactToken(body.access_token)} token_type=${body.token_type} expires_in=${body.expires_in}`
    );
    return body.access_token;
  }
  console.log(`    ${text.slice(0, 300)}`);
  return null;
}

function createPayload(dateStyle) {
  // Dates: UAT enforces DatePaid not-in-future ("cannot be in the future or
  // before 01/01/1980") AND before TenancyStartDate → paid yesterday, start in
  // 30 days.
  const start = new Date();
  start.setDate(start.getDate() + 30);
  const paid = new Date();
  paid.setDate(paid.getDate() - 1);
  const fmt = (d) =>
    dateStyle === "iso"
      ? d.toISOString().slice(0, 10)
      : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  return {
    AgentLandlordId: Number(agentLandlordId),
    DatePaid: fmt(paid),
    PropertyType: 4, // FlatApartment
    FurnishingType: 1, // Furnished
    NumberOfBedrooms: 2,
    RentAmount: "1000.00",
    RentFrequency: 1, // Monthly
    TenancyStartDate: fmt(start),
    TenancyLength: 12,
    DepositAmount: "1000.00",
    TenancyReference: "HARBORPROBE",
    AddressLine1: "12 Test Street",
    AddressLine2: "Flat B",
    Town: "Bristol",
    PostCode: "BS1 2AA",
    Tenants: [
      {
        tenantReference: "PROBE-T1",
        title: "Ms",
        firstName: "Anna",
        lastName: "Probe",
        emailAddress: "anna.probe.e2e@example.com",
      },
    ],
    RelevantPerson: null,
  };
}

async function post(path, token, payload) {
  const res = await fetch(`${HOST}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  const reqId = res.headers.get("x-request-id") || res.headers.get("request-id") || "";
  return { status: res.status, text, reqId };
}

async function main() {
  console.log("=== 1. Token endpoint discovery (Q3) ===");
  const candidates = ["/v1.0/connect/token", "/connect/token", "/oauth/token", "/v1.0/oauth/token"];
  let token = null;
  let tokenPath = null;
  for (const p of candidates) {
    token = await tryTokenEndpoint(p);
    if (token) {
      tokenPath = p;
      break;
    }
  }
  if (!token) {
    console.log("\nNo candidate token endpoint returned a token. Check keys, or the");
    console.log("endpoint may live on a different host — send the outputs above to DPS.");
    return;
  }
  console.log(`\n  >>> ANSWER Q3: token endpoint is ${HOST}${tokenPath}\n`);

  console.log("=== 2. Create tenancy — ISO dates first (Q2), full response body (Q1) ===");
  let r = await post("/v1.0/tenancy/create", token, createPayload("iso"));
  console.log(`  ISO dates -> HTTP ${r.status}${r.reqId ? ` (requestId ${r.reqId})` : ""}`);
  console.log(`  body: ${r.text.slice(0, 800)}`);

  const dateRejected =
    r.status === 400 && /date/i.test(r.text) && /(InvalidData|InvalidCharacters|format)/i.test(r.text);
  if (dateRejected) {
    console.log("\n  ISO rejected on a date field — retrying with DD/MM/YYYY…");
    r = await post("/v1.0/tenancy/create", token, createPayload("uk"));
    console.log(`  DD/MM/YYYY -> HTTP ${r.status}${r.reqId ? ` (requestId ${r.reqId})` : ""}`);
    console.log(`  body: ${r.text.slice(0, 800)}`);
    if (r.status === 200) console.log("\n  >>> ANSWER Q2: API wants DD/MM/YYYY");
  } else if (r.status === 200) {
    console.log("\n  >>> ANSWER Q2: API accepts ISO (YYYY-MM-DD)");
  }

  // Q1: find the deposit id whatever the key is called.
  let depositId = null;
  try {
    const body = JSON.parse(r.text);
    const scan = (obj) => {
      for (const [k, v] of Object.entries(obj ?? {})) {
        if (/deposit\s*_?\s*id/i.test(k)) return { key: k, value: v };
        if (v && typeof v === "object") {
          const hit = scan(v);
          if (hit) return hit;
        }
      }
      return null;
    };
    const hit = scan(body);
    if (hit) {
      depositId = String(hit.value);
      console.log(`\n  >>> ANSWER Q1: deposit id key is ${JSON.stringify(hit.key)} = ${depositId}`);
    }
  } catch {
    console.log("\n  Response was not valid JSON — raw body above IS the Q1 answer; note it.");
  }

  if (!depositId) {
    console.log("\n  No deposit id found in the create response — skipping MarkForBankTransfer.");
    return;
  }

  console.log("\n=== 3. MarkForBankTransfer with the mock deposit id (Q7) ===");
  const m = await post("/v1.0/tenancy/MarkForBankTransfer", token, {
    DepositId: depositId,
    AllocationReference: "HARBORPROBE1",
  });
  console.log(`  -> HTTP ${m.status}${m.reqId ? ` (requestId ${m.reqId})` : ""}`);
  console.log(`  body: ${m.text.slice(0, 800)}`);
}

main().catch((err) => {
  console.error("Probe crashed:", err);
  process.exit(1);
});

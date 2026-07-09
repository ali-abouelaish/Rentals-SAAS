// TDS Custodial UAT probe — settles the one open documentation ambiguity before
// we go live (see project_tds_integration memory + mapDeposit.ts TDS_DATE_SEPARATOR):
//
//   Q: which date separator does CreateDeposit accept?
//      The field "Format" column says DD-MM-YYYY (hyphens); the "Example" column
//      in the SAME rows shows 20/03/2017 (slashes). mapDeposit.ts currently
//      defaults to "/". This proves which one the sandbox actually validates.
//
//   node --env-file=.env.local scripts/tds-uat-probe.mjs
//
// Credentials — two ways (env wins if both present):
//  A) Explicit sandbox creds in .env.local:
//       TDS_TEST_MEMBER_ID=188832
//       TDS_TEST_BRANCH_ID=0            (single-branch members use 0)
//       TDS_TEST_API_KEY=35467-65389-26539-97536
//       TDS_TEST_REGION=EW             (optional, default EW)
//       TDS_TEST_SCHEME_TYPE=Custodial (optional, default Custodial)
//  B) Loaded from the tds_connections table (a super admin already saved them).
//     Uses SUPABASE_SERVICE_ROLE_KEY + TDS_TOKEN_SECRET (both in .env.local) to
//     read + decrypt the row. Optionally pin a tenant with TDS_TEST_TENANT_ID;
//     otherwise the single sandbox row is used. PRODUCTION rows are refused —
//     this probe only ever talks to the sandbox host.
//
// CreateDeposit is ASYNC: the POST returns a batch_id if the request was
// accepted for processing; the real per-field validation surfaces on the
// CreateDepositStatus poll. So for each date format we POST, then poll the
// batch until it reaches Created/Failed, and inspect the errors for anything
// date-related. The format that does NOT produce a date error is the answer.

import { createDecipheriv } from "crypto";

const HOST = "https://sandbox.api.custodial.tenancydepositscheme.com";
const VERSION = "v1.2";

// ── credential resolution (env creds, else the tds_connections DB row) ───────
function decryptTdsSecret(stored) {
  const secret = process.env.TDS_TOKEN_SECRET;
  if (!secret) throw new Error("TDS_TOKEN_SECRET env var is not set.");
  const key = Buffer.from(secret, "hex");
  if (key.length !== 32) throw new Error("TDS_TOKEN_SECRET must be 32-byte hex (64 chars).");
  const [ivHex, encHex, tagHex] = stored.split(":");
  if (!ivHex || !encHex || !tagHex) throw new Error("Invalid encrypted token format.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(encHex, "hex")) + decipher.final("utf8");
}

async function loadCredsFromDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to load creds from the DB.");
  }
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let q = admin
    .from("tds_connections")
    .select("tenant_id, environment, member_id, branch_id, api_key, region, scheme_type");
  if (process.env.TDS_TEST_TENANT_ID) q = q.eq("tenant_id", process.env.TDS_TEST_TENANT_ID);

  const { data, error } = await q;
  if (error) throw new Error(`tds_connections query failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(
      process.env.TDS_TEST_TENANT_ID
        ? `No tds_connections row for tenant ${process.env.TDS_TEST_TENANT_ID}.`
        : "No rows in tds_connections."
    );
  }
  if (data.length > 1) {
    const list = data.map((r) => `${r.tenant_id} (${r.environment})`).join(", ");
    throw new Error(`Multiple tds_connections rows — pin one with TDS_TEST_TENANT_ID. Found: ${list}`);
  }

  const row = data[0];
  const environment = row.environment ?? "sandbox";
  if (environment !== "sandbox") {
    throw new Error(
      `Refusing to run: tenant ${row.tenant_id} has environment="${environment}". ` +
        `This probe only talks to the sandbox host and must never use production credentials.`
    );
  }
  console.log(`Loaded sandbox creds from tds_connections for tenant ${row.tenant_id}.`);
  return {
    memberId: row.member_id,
    branchId: row.branch_id ?? "0",
    apiKey: decryptTdsSecret(row.api_key),
    region: row.region || "EW",
    schemeType: row.scheme_type || "Custodial",
  };
}

async function resolveCreds() {
  if (process.env.TDS_TEST_MEMBER_ID && process.env.TDS_TEST_API_KEY) {
    console.log("Using explicit TDS_TEST_* creds from the environment.");
    return {
      memberId: process.env.TDS_TEST_MEMBER_ID,
      branchId: process.env.TDS_TEST_BRANCH_ID ?? "0",
      apiKey: process.env.TDS_TEST_API_KEY,
      region: process.env.TDS_TEST_REGION || "EW",
      schemeType: process.env.TDS_TEST_SCHEME_TYPE || "Custodial",
    };
  }
  return loadCredsFromDb();
}

// Populated by main() before any request is built.
let memberId, branchId, apiKey, region, schemeType;

// ── date helpers ────────────────────────────────────────────────────────────
// Keep everything comfortably inside 01/01/1980–31/12/2099. Received yesterday,
// tenancy starts in 30 days and runs 12 months.
function fmt(d, sep) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return [dd, mm, yyyy].join(sep);
}
const start = new Date();
start.setDate(start.getDate() + 30);
const end = new Date(start);
end.setFullYear(end.getFullYear() + 1);
const received = new Date();
received.setDate(received.getDate() - 1);

// A unique-per-run tag so user_tenancy_reference / emails never collide across
// re-runs (TDS rejects duplicate references and shared tenant/landlord emails).
const runTag = Date.now().toString(36);

function buildPayload(sep, tag) {
  const ref = `PROBE-${runTag}-${tag}`;
  return {
    member_id: memberId,
    branch_id: branchId,
    api_key: apiKey,
    region,
    scheme_type: schemeType,
    tenancy: [
      {
        user_tenancy_reference: ref,
        // Property must be in England or Wales for region EW (sandbox rejects a
        // Scottish/NI postcode with "must address in England or Wales").
        property_paon: "1",
        property_saon: "",
        property_street: "Maylands Avenue",
        property_locality: "",
        property_town: "Hemel Hempstead",
        property_administrative_area: "Hertfordshire",
        property_postcode: "HP2 7TG",
        furnished_status: "furnished",
        tenancy_start_date: fmt(start, sep),
        tenancy_expected_end_date: fmt(end, sep),
        rent_amount: 999.0,
        deposit_amount: 1250.0,
        deposit_amount_to_protect: 1250.0,
        deposit_received_date: fmt(received, sep),
        number_of_tenants: 1,
        number_of_landlords: 1,
        people: [
          {
            person_classification: "Lead Tenant",
            person_title: "Mr",
            person_firstname: "Lead",
            person_surname: "Tenant",
            is_business: "N",
            person_email: `probe.${runTag}.${tag}.tenant@example.com`,
          },
          {
            person_classification: "Primary Landlord",
            person_title: "Miss",
            person_firstname: "Primary",
            person_surname: "Landlord",
            is_business: "N",
            person_paon: "1",
            person_street: "Maylands Avenue",
            person_town: "Hemel Hempstead",
            person_administrative_area: "Hertfordshire",
            person_postcode: "HP2 7TG",
            person_country: "United Kingdom",
            person_email: `probe.${runTag}.${tag}.landlord@example.com`,
          },
        ],
      },
    ],
  };
}

function redactApiKey(payload) {
  return { ...payload, api_key: "***" };
}

async function postJson(path, body) {
  const res = await fetch(`${HOST}/${VERSION}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, json };
}

async function getStatus(batchId) {
  const path = `CreateDepositStatus/${encodeURIComponent(memberId)}/${encodeURIComponent(
    branchId
  )}/${encodeURIComponent(apiKey)}/${encodeURIComponent(batchId)}`;
  const res = await fetch(`${HOST}/${VERSION}/${path}`, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, text, json };
}

function stringifyErrors(json) {
  if (!json || typeof json !== "object") return "";
  const parts = [];
  if (typeof json.error === "string") parts.push(json.error);
  const errs = json.errors;
  if (Array.isArray(errs)) parts.push(JSON.stringify(errs));
  else if (errs && typeof errs === "object") parts.push(JSON.stringify(errs));
  return parts.join(" | ");
}

// A "date problem" = an error that names one of the date fields or complains
// about a date/format. That's the signal the separator was wrong.
function hasDateError(blob) {
  return /tenancy_start_date|tenancy_expected_end_date|deposit_received_date|\bdate\b|format/i.test(
    blob || ""
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runFormat(label, sep) {
  console.log(`\n=== CreateDeposit with "${sep}" dates (${label}) ===`);
  const payload = buildPayload(sep, label);
  const sample = payload.tenancy[0];
  console.log(
    `  dates: start=${sample.tenancy_start_date} end=${sample.tenancy_expected_end_date} received=${sample.deposit_received_date}`
  );
  console.log(`  ref:   ${sample.user_tenancy_reference}`);

  const post = await postJson("CreateDeposit", payload);
  console.log(`  POST CreateDeposit -> HTTP ${post.status}`);
  console.log(`    body: ${post.text.slice(0, 500)}`);

  const success = post.json?.isSuccess === true || post.json?.success === true || post.json?.success === "true";
  const batchId = post.json?.batch_id != null ? String(post.json.batch_id) : null;

  if (!success && !batchId) {
    const blob = stringifyErrors(post.json) || post.text;
    const verdict = hasDateError(blob) ? "REJECTED on a DATE field" : "rejected (non-date reason)";
    console.log(`  >>> ${label}: synchronous ${verdict}`);
    return { label, sep, outcome: verdict, dateError: hasDateError(blob) };
  }

  if (!batchId) {
    console.log(`  >>> ${label}: accepted but no batch_id returned — can't poll status.`);
    return { label, sep, outcome: "no batch_id", dateError: false };
  }

  console.log(`  batch_id=${batchId} — polling CreateDepositStatus…`);
  let last = null;
  // Sandbox async validation can take a couple of minutes; poll ~150s.
  for (let i = 0; i < 30; i++) {
    await sleep(5000);
    const st = await getStatus(batchId);
    const statusStr = (st.json?.status ?? "").toString();
    console.log(`    poll ${i + 1}: HTTP ${st.status} status="${statusStr}" ${st.text.slice(0, 300)}`);
    last = st;
    if (/created|failed/i.test(statusStr)) break;
  }

  const blob = last ? stringifyErrors(last.json) || last.text : "";
  const statusStr = (last?.json?.status ?? "").toString().toLowerCase();
  const dateError = hasDateError(blob);
  let outcome;
  if (statusStr === "created") outcome = "CREATED (dates accepted)";
  else if (dateError) outcome = "FAILED on a DATE field";
  else if (statusStr === "failed") outcome = "failed (non-date reason → dates were accepted)";
  else outcome = `inconclusive (status="${statusStr}")`;
  console.log(`  >>> ${label}: ${outcome}`);
  return { label, sep, outcome, dateError };
}

async function main() {
  const creds = await resolveCreds();
  ({ memberId, branchId, apiKey, region, schemeType } = creds);

  console.log(`\nTDS sandbox probe — host ${HOST}`);
  console.log(`member_id=${memberId} branch_id=${branchId} region=${region} scheme_type=${schemeType}`);
  console.log(`(api_key redacted; sample payload uses api_key="***" when printed)`);
  console.log(`\nsample redacted payload:\n${JSON.stringify(redactApiKey(buildPayload("-", "hyphen")), null, 2)}`);

  // Spec's Format column first (hyphen), then the Example column / current code default (slash).
  const hyphen = await runFormat("hyphen", "-");
  const slash = await runFormat("slash", "/");

  console.log("\n=== VERDICT ===");
  const good = [hyphen, slash].filter((r) => !r.dateError && /created|non-date/i.test(r.outcome));
  if (good.length === 1) {
    console.log(`  Use separator "${good[0].sep}" (${good[0].label}). The other produced a date error.`);
    console.log(`  → set TDS_DATE_SEPARATOR = "${good[0].sep}" in src/lib/tds/mapDeposit.ts`);
  } else if (good.length === 2) {
    console.log(`  Both formats cleared date validation — TDS accepts either. Keep the current "/".`);
  } else {
    console.log(`  Neither cleared cleanly. Read the bodies above:`);
    console.log(`   - hyphen: ${hyphen.outcome}`);
    console.log(`   - slash:  ${slash.outcome}`);
    console.log(`  If both failed on the SAME non-date field, that field (not the date) is the blocker.`);
  }
}

main().catch((err) => {
  console.error("Probe crashed:", err);
  process.exit(1);
});

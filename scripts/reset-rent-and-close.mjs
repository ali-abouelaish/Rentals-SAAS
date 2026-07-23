// Reset rent so the only outstanding/missing month is the CURRENT month (July 2026),
// and close (terminate) any open contract that has no linked property.
//
// DRY-RUN by default. Pass --apply to write changes.
//
//   node scripts/reset-rent-and-close.mjs            # report only
//   node scripts/reset-rent-and-close.mjs --apply    # perform changes
//
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env
// (loaded from .env.local below). Uses the service role key -> bypasses RLS,
// so it operates across ALL tenants.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// --- tiny .env.local loader (no dotenv dependency) ---
try {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* ignore, rely on ambient env */
}

const APPLY = process.argv.includes("--apply");

// The "current" period that must remain the ONLY missing month.
const CURRENT_YEAR = 2026;
const CURRENT_MONTH = 7; // July

const OPEN_STATUSES = ["active", "signed", "notice_given"];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// month arithmetic on {y, m} where m is 1-12
function monthsInclusive(startY, startM, endY, endM) {
  const out = [];
  let y = startY;
  let m = startM;
  while (y < endY || (y === endY && m <= endM)) {
    out.push({ y, m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function fmtMonth({ y, m }) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

async function main() {
  console.log(
    `\n=== reset-rent-and-close  [${APPLY ? "APPLY" : "DRY-RUN"}]  target host: ${SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0]} ===\n`
  );

  // Pull all open contracts with the unit -> property join.
  const { data: contracts, error } = await supabase
    .from("property_contracts")
    .select(
      "id, tenant_id, unit_id, start_date, rent_pcm, pro_rata_amount, status, " +
        "unit:units(id, room_number, property:properties(id, name))"
    )
    .in("status", OPEN_STATUSES);
  if (error) throw error;

  const tenantsRes = await supabase.from("tenants").select("id, name");
  if (tenantsRes.error) throw tenantsRes.error;
  const tenantName = new Map(tenantsRes.data.map((t) => [t.id, t.name]));

  const noProperty = [];
  const withProperty = [];
  for (const c of contracts ?? []) {
    const prop = c.unit?.property ?? null;
    if (!prop || !prop.id) noProperty.push(c);
    else withProperty.push(c);
  }

  // ---- Existing rent_payments for the contracts we care about ----
  const allIds = [...contracts.map((c) => c.id)];
  const existing = new Map(); // contractId -> Set("y-m")
  for (let i = 0; i < allIds.length; i += 200) {
    const batch = allIds.slice(i, i + 200);
    const { data, error: pErr } = await supabase
      .from("rent_payments")
      .select("id, contract_id, period_year, period_month")
      .in("contract_id", batch);
    if (pErr) throw pErr;
    for (const p of data ?? []) {
      if (!existing.has(p.contract_id)) existing.set(p.contract_id, new Set());
      existing.get(p.contract_id).add(`${p.period_year}-${p.period_month}`);
    }
  }

  // ---- Plan rent backfill (open contracts WITH a property) ----
  const inserts = [];
  let julyDeleteContractIds = [];
  let contractsTouched = 0;

  for (const c of withProperty) {
    const start = new Date(c.start_date + "T00:00:00Z");
    const sY = start.getUTCFullYear();
    const sM = start.getUTCMonth() + 1;

    // months from start .. June 2026 (i.e. everything strictly before July 2026)
    let endY = CURRENT_YEAR;
    let endM = CURRENT_MONTH - 1; // June
    if (endM < 1) {
      endM = 12;
      endY -= 1;
    }
    // If the contract starts in or after the current month, nothing to backfill.
    const startsBeforeCurrent = sY < CURRENT_YEAR || (sY === CURRENT_YEAR && sM < CURRENT_MONTH);
    if (!startsBeforeCurrent) continue;

    const months = monthsInclusive(sY, sM, endY, endM);
    const have = existing.get(c.id) ?? new Set();
    const proRata = c.pro_rata_amount == null ? null : Number(c.pro_rata_amount);
    const rent = Number(c.rent_pcm);

    let addedForContract = 0;
    for (const { y, m } of months) {
      if (have.has(`${y}-${m}`)) continue; // already paid
      const isMoveIn = y === sY && m === sM;
      const amount = isMoveIn && proRata != null && proRata > 0 ? proRata : rent;
      inserts.push({
        tenant_id: c.tenant_id,
        contract_id: c.id,
        unit_id: c.unit_id,
        period_year: y,
        period_month: m,
        amount,
        paid_at: new Date(Date.UTC(y, m - 1, 1, 12, 0, 0)).toISOString(),
        notes: "Backfilled: arrears reset (only current month outstanding)",
      });
      addedForContract += 1;
    }
    if (addedForContract > 0) contractsTouched += 1;
    julyDeleteContractIds.push(c.id);
  }

  // ---- REPORT ----
  console.log(`Open contracts scanned: ${contracts.length}`);
  console.log(`  - with a property:    ${withProperty.length}`);
  console.log(`  - WITHOUT a property: ${noProperty.length}  (would be CLOSED/terminated)\n`);

  if (noProperty.length) {
    console.log("Contracts to CLOSE (no property):");
    for (const c of noProperty) {
      console.log(
        `  ${c.id}  tenant=${tenantName.get(c.tenant_id) ?? c.tenant_id}  status=${c.status}  unit=${c.unit_id}  start=${c.start_date}`
      );
    }
    console.log("");
  }

  const monthsToDelete = withProperty.filter((c) =>
    (existing.get(c.id) ?? new Set()).has(`${CURRENT_YEAR}-${CURRENT_MONTH}`)
  );
  console.log(
    `Rent backfill: ${inserts.length} rent_payments rows to INSERT across ${contractsTouched} contracts.`
  );
  console.log(
    `Current-month (${fmtMonth({ y: CURRENT_YEAR, m: CURRENT_MONTH })}) rows to DELETE so it shows missing: ${monthsToDelete.length}\n`
  );

  // Sample of the backfill grouped by contract
  const byContract = new Map();
  for (const ins of inserts) {
    if (!byContract.has(ins.contract_id)) byContract.set(ins.contract_id, []);
    byContract.get(ins.contract_id).push(fmtMonth({ y: ins.period_year, m: ins.period_month }));
  }
  let shown = 0;
  for (const [cid, mm] of byContract) {
    if (shown >= 8) {
      console.log(`  ... and ${byContract.size - shown} more contracts`);
      break;
    }
    console.log(`  ${cid}: +${mm.length} months (${mm[0]} … ${mm[mm.length - 1]})`);
    shown += 1;
  }
  console.log("");

  if (!APPLY) {
    console.log("DRY-RUN complete. Re-run with --apply to perform these changes.\n");
    return;
  }

  // ---- APPLY ----
  // 1) Close contracts with no property
  if (noProperty.length) {
    const ids = noProperty.map((c) => c.id);
    const { error: upErr } = await supabase
      .from("property_contracts")
      .update({ status: "terminated" })
      .in("id", ids);
    if (upErr) throw upErr;
    console.log(`Closed ${ids.length} contracts (status -> terminated).`);
  }

  // 2) Delete current-month rows for open+property contracts
  const withPropIds = withProperty.map((c) => c.id);
  for (let i = 0; i < withPropIds.length; i += 200) {
    const batch = withPropIds.slice(i, i + 200);
    const { error: delErr } = await supabase
      .from("rent_payments")
      .delete()
      .in("contract_id", batch)
      .eq("period_year", CURRENT_YEAR)
      .eq("period_month", CURRENT_MONTH);
    if (delErr) throw delErr;
  }
  console.log(`Deleted current-month (${fmtMonth({ y: CURRENT_YEAR, m: CURRENT_MONTH })}) rent rows.`);

  // 3) Insert backfill rows (ignore duplicates via unique index)
  for (let i = 0; i < inserts.length; i += 500) {
    const batch = inserts.slice(i, i + 500);
    const { error: insErr } = await supabase
      .from("rent_payments")
      .upsert(batch, {
        onConflict: "contract_id,period_year,period_month",
        ignoreDuplicates: true,
      });
    if (insErr) throw insErr;
  }
  console.log(`Inserted ${inserts.length} backfill rent rows.`);
  console.log("\nDone.\n");
}

main().catch((e) => {
  console.error("Failed:", e.message ?? e);
  process.exit(1);
});

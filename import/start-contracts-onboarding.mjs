// Onboarding pass (Option B): start a contract on every non-available unit
// that doesn't have a live one, using an agreed placeholder start date.
//
//   node --env-file=.env.local import/start-contracts-onboarding.mjs            # dry run
//   node --env-file=.env.local import/start-contracts-onboarding.mjs --commit   # apply
//
// Rules (decided by Ali, 13 Jun 2026):
// - Placeholder start date 2026-06-01 for every started contract; the contract
//   notes say so explicitly ("replace with real AST date").
// - Units with a linked pm_tenant use that tenant. Units without one get a
//   placeholder person: "Tenant Placeholder Change ASAP (<property> <room>)"
//   with contact fields 'unknown' — rename in place when AP supplies the real
//   tenant; the contract survives.
// - rent_pcm = unit min price (falls back to max, then deposit); deposit = one
//   month's rent (standing rule). Units with no price at all are skipped and
//   reported.
// - expiry_date = unit.available_date when it is after the start date.
// - deposit_protection_alert = false (a deadline computed from a placeholder
//   date would be noise); deposit_scheme stays 'none'.
// - June 2026 is recorded as paid for every contract this pass creates
//   (standing instruction: everyone but available rooms paid June).
// - Idempotent: units with a live contract are skipped; reruns create nothing twice.

import { DEFAULT_TENANT_ID } from "./config.mjs";
import { adminClient } from "./lib/db.mjs";

const COMMIT = process.argv.includes("--commit");
const START_DATE = "2026-06-01";
const LIVE = ["active", "notice_given", "signed"];

async function main() {
  const t = DEFAULT_TENANT_ID;
  const sb = adminClient();
  const get = async (q) => {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  };

  const [units, props, ports, cons, pays] = await Promise.all([
    get(sb.from("units").select("id, room_number, status, pm_tenant_id, min_price_pcm, max_price_pcm, deposit, available_date, property_id").eq("tenant_id", t).order("id")),
    get(sb.from("properties").select("id, name, portfolio_id").eq("tenant_id", t)),
    get(sb.from("portfolios").select("id, name").eq("tenant_id", t)),
    get(sb.from("property_contracts").select("id, unit_id, status").eq("tenant_id", t)),
    get(sb.from("rent_payments").select("contract_id").eq("tenant_id", t).eq("period_year", 2026).eq("period_month", 6)),
  ]);

  const prop = Object.fromEntries(props.map((p) => [p.id, p]));
  const port = Object.fromEntries(ports.map((p) => [p.id, p.name]));
  const liveUnits = new Set(cons.filter((c) => LIVE.includes(c.status)).map((c) => c.unit_id));
  const junePaid = new Set(pays.map((p) => p.contract_id));

  const targets = units.filter((u) => u.status !== "available" && !liveUnits.has(u.id));
  const skipped = [];
  const plan = [];

  for (const u of targets) {
    const p = prop[u.property_id];
    const label = `${port[p?.portfolio_id] ?? "?"} | ${p?.name ?? "?"} room ${u.room_number}`;
    const rent = u.min_price_pcm ?? u.max_price_pcm ?? u.deposit;
    if (rent == null) {
      skipped.push({ label, reason: "no price on the unit (rent_pcm is NOT NULL) — set a PCM first" });
      continue;
    }
    const expiry = u.available_date && u.available_date > START_DATE ? u.available_date : null;
    plan.push({
      unit: u, label, rent, expiry,
      needsPlaceholder: !u.pm_tenant_id,
      placeholderName: `Tenant Placeholder Change ASAP (${p?.name ?? "?"} ${u.room_number ?? "unnamed room"})`,
    });
  }

  const withTenant = plan.filter((x) => !x.needsPlaceholder).length;
  console.log(`${COMMIT ? "COMMIT" : "DRY RUN"} — starting ${plan.length} contracts (${withTenant} with linked tenants, ${plan.length - withTenant} with placeholder tenants), start date ${START_DATE}`);
  for (const x of plan) {
    console.log(`  ${x.label.padEnd(55)} £${String(x.rent).padEnd(5)} expiry ${x.expiry ?? "—"}  ${x.needsPlaceholder ? "+placeholder tenant" : ""}`);
  }
  for (const s of skipped) console.log(`  SKIPPED: ${s.label} — ${s.reason}`);
  if (!COMMIT) {
    console.log(`\nDry run — nothing written. Re-run with --commit to apply.`);
    return;
  }

  let tenantsCreated = 0, contractsCreated = 0, paymentsCreated = 0, mirrors = 0;
  for (const x of plan) {
    let pmTenantId = x.unit.pm_tenant_id;
    if (!pmTenantId) {
      // Reuse an identically-named placeholder from an interrupted earlier run.
      const existing = await get(sb.from("pm_tenants").select("id").eq("tenant_id", t).eq("full_name", x.placeholderName).limit(1));
      if (existing.length) pmTenantId = existing[0].id;
      else {
        const ins = await get(sb.from("pm_tenants").insert({
          tenant_id: t,
          full_name: x.placeholderName,
          email: "unknown",
          phone: "unknown",
          notes: `Onboarding placeholder for ${x.label} created ${START_DATE} — replace with the real tenant ASAP (edit this record in place; the contract stays).`,
        }).select("id"));
        pmTenantId = ins[0].id;
        tenantsCreated++;
      }
    }

    const ins = await get(sb.from("property_contracts").insert({
      tenant_id: t,
      unit_id: x.unit.id,
      pm_tenant_id: pmTenantId,
      start_date: START_DATE,
      rent_pcm: x.rent,
      deposit: x.rent,
      deposit_scheme: "none",
      deposit_protection_alert: false,
      status: "active",
      expiry_date: x.expiry,
      notes: `Onboarding: placeholder start date ${START_DATE} — replace with the real AST date.${x.needsPlaceholder ? " Tenant is a placeholder — replace ASAP." : ""}`,
    }).select("id"));
    const contractId = ins[0].id;
    contractsCreated++;

    if (!x.unit.pm_tenant_id) {
      const { error } = await sb.from("units").update({ pm_tenant_id: pmTenantId, updated_at: new Date().toISOString() }).eq("id", x.unit.id).eq("tenant_id", t);
      if (error) console.log(`  warn: unit mirror failed for ${x.label}: ${error.message}`);
      else mirrors++;
    }

    if (!junePaid.has(contractId)) {
      const { error } = await sb.from("rent_payments").insert({
        tenant_id: t, contract_id: contractId, unit_id: x.unit.id,
        period_year: 2026, period_month: 6, amount: x.rent,
        paid_at: `${START_DATE}T12:00:00Z`,
        notes: "Onboarding: June 2026 rent marked as paid",
      });
      if (error) console.log(`  warn: June payment failed for ${x.label}: ${error.message}`);
      else paymentsCreated++;
    }
  }

  console.log(`\nDone: ${contractsCreated} contracts, ${tenantsCreated} placeholder tenants, ${mirrors} unit links, ${paymentsCreated} June payments.`);
}

main().catch((e) => { console.error(`FATAL: ${e.stack ?? e}`); process.exitCode = 1; });

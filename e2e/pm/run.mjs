// PM E2E runner — runs the phases in order, or resumes from a checkpoint.
//
//   node e2e/pm/run.mjs                 # every phase that exists, in order
//   node e2e/pm/run.mjs --from p05      # resume at p05 (and continue)
//   node e2e/pm/run.mjs --only p01      # just one phase
//   node e2e/pm/run.mjs --no-gate       # skip the usage gate (CI / local)
//
// Before each phase it runs `node e2e/usage-gate.mjs`. On `wait` it stops and
// exits 10 — Claude then schedules the resume cron and ends the turn, per the
// run protocol. On `ok`/`unknown` it proceeds (unknown just means no snapshot).
//
// Each phase is its own `node` process, so one phase crashing can never take the
// next down with it; the exit code is recorded and the run moves on. At the end
// it regenerates the report's auto sections via report.mjs.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");

// The full plan. A phase with no script yet is reported as `pending` and skipped,
// so the runner works today and grows as each phase script lands.
const PHASES = [
  ["p00", "Preflight", "p00-preflight.mjs"],
  ["p01", "Route smoke", "p01-route-smoke.mjs"],
  ["p02", "Properties & units", "p02-properties.mjs"],
  ["p03", "Booking forms & public apply", "p03-forms.mjs"],
  ["p04", "Bookings → tenancy → contract", "p04-contracts.mjs"],
  ["p05", "Tenants", "p05-tenants.mjs"],
  ["p06", "Rent, statements, finances, profitability", "p06-finances.mjs"],
  ["p07", "Maintenance & compliance", "p07-maintenance.mjs"],
  ["p08", "Owners & statements", "p08-owners.mjs"],
  ["p09", "Forms, shares, automations, reminders, inbox, acquisition", "p09-growth.mjs"],
  ["p10", "PM settings", "p10-settings.mjs"],
  ["p11", "Dashboard, search, help, UI rules", "p11-dashboard.mjs"],
  ["p12", "Isolation", "p12-isolation.mjs"],
  ["p13", "Mobile regression", "p13-mobile.mjs"],
  // Gap-fill coverage (added after the first pass; run before cleanup).
  ["p15", "Tenancy + rent + month close", "p15-tenancy-rent.mjs"],
  ["p16", "Owner-statement maths", "p16-owner-maths.mjs"],
  ["p17", "Deep sub-flows (guarantor/RTR/form editor)", "p17-subflows.mjs"],
  ["p14", "Cleanup", "p14-cleanup.mjs"],
];

const argv = process.argv.slice(2);
const fromIdx = argv.indexOf("--from");
const onlyIdx = argv.indexOf("--only");
const from = fromIdx !== -1 ? argv[fromIdx + 1] : null;
const only = onlyIdx !== -1 ? argv[onlyIdx + 1] : null;
const noGate = argv.includes("--no-gate");

let started = !from;
const selected = PHASES.filter(([id]) => {
  if (only) return id === only;
  if (!started && id === from) started = true;
  return started;
});

function gate() {
  if (noGate) return { verdict: "ok" };
  const g = spawnSync("node", ["e2e/usage-gate.mjs"], { cwd: REPO, encoding: "utf8" });
  try {
    return JSON.parse(g.stdout || "{}");
  } catch {
    return { verdict: "unknown" };
  }
}

const ran = [];
for (const [id, title, file] of selected) {
  const scriptPath = path.join(HERE, file);
  if (!fs.existsSync(scriptPath)) {
    console.log(`\n=== ${id} ${title} — PENDING (no ${file} yet), skipping ===`);
    ran.push({ id, title, status: "pending", exit: null });
    continue;
  }

  const g = gate();
  if (g.verdict === "wait") {
    console.log(`\n*** USAGE GATE: wait — pausing before ${id} ***`);
    console.log(JSON.stringify(g, null, 2));
    console.log(`\nResume with:  node e2e/pm/run.mjs --from ${id}`);
    regenReport(ran);
    process.exit(10);
  }
  if (g.verdict === "unknown") console.log(`  (usage gate unknown — ${g.reason ?? "no snapshot"}; proceeding)`);

  console.log(`\n=== ${id} ${title} ===`);
  const res = spawnSync("node", [path.join("e2e", "pm", file)], { cwd: REPO, stdio: "inherit" });
  const status = res.status === 0 ? "done" : "failed";
  ran.push({ id, title, status, exit: res.status });
}

regenReport(ran);

const failed = ran.filter((r) => r.status === "failed");
console.log(`\nRun complete: ${ran.filter((r) => r.status === "done").length} done, ${failed.length} failed, ${ran.filter((r) => r.status === "pending").length} pending.`);
if (failed.length) console.log(`Failed phases: ${failed.map((r) => r.id).join(", ")}`);
process.exit(failed.length ? 1 : 0);

function regenReport(ranPhases) {
  // Hand the run outcome to report.mjs via a small state file, then let it
  // rebuild the report's auto sections from the per-phase JSON.
  try {
    fs.writeFileSync(path.join(HERE, "..", "artifacts", "pm", "run-state.json"), JSON.stringify({ ranAt: new Date().toISOString(), phases: ranPhases }, null, 2));
    spawnSync("node", [path.join("e2e", "pm", "report.mjs")], { cwd: REPO, stdio: "inherit" });
  } catch (err) {
    console.log(`  (report regen skipped: ${err.message})`);
  }
}

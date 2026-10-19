// Regenerate the auto sections of docs/e2e-pm-test-report.md from the per-phase
// JSON in e2e/artifacts/pm/. The bug log and prose are hand-maintained and left
// untouched; only the blocks between AUTO markers are rewritten.
//
//   node e2e/pm/report.mjs
//
// Auto blocks (each delimited by <!-- AUTO:X --> ... <!-- /AUTO:X -->):
//   CHECKPOINT — phase | status | last run | pass | fail | skip. A resume reads this.
//   CAPTURED   — console/page/5xx/overlay errors grouped by route.
//   SKIPPED    — skipped steps and their reasons.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const ART = path.join(REPO, "e2e", "artifacts", "pm");
const DOC = path.join(REPO, "docs", "e2e-pm-test-report.md");

const PHASES = [
  ["p00", "Preflight"],
  ["p01", "Route smoke"],
  ["p02", "Properties & units"],
  ["p03", "Booking forms & public apply"],
  ["p04", "Bookings → tenancy → contract"],
  ["p05", "Tenants"],
  ["p06", "Rent, statements, finances, profitability"],
  ["p07", "Maintenance & compliance"],
  ["p08", "Owners & statements"],
  ["p09", "Forms, shares, automations, reminders, inbox, acquisition"],
  ["p10", "PM settings"],
  ["p11", "Dashboard, search, help, UI rules"],
  ["p12", "Isolation"],
  ["p13", "Mobile regression"],
  ["p15", "Tenancy + rent + month close"],
  ["p16", "Owner-statement maths"],
  ["p17", "Deep sub-flows (guarantor/RTR/form editor)"],
  ["p14", "Cleanup"],
];

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

const runState = readJson(path.join(ART, "run-state.json"), { phases: [] });
const statusById = new Map((runState.phases ?? []).map((p) => [p.id, p.status]));

const phaseData = new Map();
for (const [id] of PHASES) {
  const data = readJson(path.join(ART, `${id}.json`), null);
  if (data) phaseData.set(id, data);
}

// --- CHECKPOINT -------------------------------------------------------------
function checkpointTable() {
  const rows = PHASES.map(([id, title]) => {
    const d = phaseData.get(id);
    let status = statusById.get(id) ?? (d ? "done" : "pending");
    if (d && d.fail > 0 && status === "done") status = "done (failures)";
    const lastRun = d?.ranAt ? d.ranAt.replace("T", " ").slice(0, 16) : "—";
    const pass = d ? d.pass : "—";
    const fail = d ? d.fail : "—";
    const skip = d ? d.skipped : "—";
    return `| ${id} | ${title} | ${status} | ${lastRun} | ${pass} | ${fail} | ${skip} |`;
  });
  return [
    "| Phase | Covers | Status | Last run (UTC) | Pass | Fail | Skip |",
    "|---|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}

// --- CAPTURED ---------------------------------------------------------------
function capturedSection() {
  const all = [];
  for (const [id] of PHASES) {
    const d = phaseData.get(id);
    for (const c of d?.captured ?? []) all.push(c);
  }
  if (all.length === 0) return "_No console/page/5xx/overlay errors captured._";
  const byRoute = new Map();
  for (const c of all) {
    const key = c.route ?? "-";
    if (!byRoute.has(key)) byRoute.set(key, []);
    byRoute.get(key).push(c);
  }
  const blocks = [];
  for (const [route, items] of [...byRoute.entries()].sort()) {
    blocks.push(`**\`${route}\`** (${items.length})`);
    blocks.push("");
    blocks.push("| Phase/Step | Type | Severity | Message |");
    blocks.push("|---|---|---|---|");
    for (const c of items) {
      const msg = (c.message ?? "").replace(/\|/g, "\\|").slice(0, 180);
      blocks.push(`| ${c.step ?? "-"} | ${c.type} | ${c.severity ?? "-"} | ${msg} |`);
    }
    blocks.push("");
  }
  return blocks.join("\n");
}

// --- SKIPPED ----------------------------------------------------------------
function skippedSection() {
  const rows = [];
  for (const [id] of PHASES) {
    const d = phaseData.get(id);
    for (const r of d?.results ?? []) {
      if (r.pass === null) rows.push(`| ${id} | ${r.id} | ${r.title} | ${(r.detail ?? "").replace(/\|/g, "\\|")} |`);
    }
  }
  if (rows.length === 0) return "_No skipped steps recorded._";
  return ["| Phase | Step | Title | Reason |", "|---|---|---|---|", ...rows].join("\n");
}

function replaceBlock(md, name, content) {
  const re = new RegExp(`(<!-- AUTO:${name} -->)([\\s\\S]*?)(<!-- /AUTO:${name} -->)`, "m");
  if (!re.test(md)) {
    console.log(`  (no AUTO:${name} marker in the report — left as-is)`);
    return md;
  }
  return md.replace(re, `$1\n${content}\n$3`);
}

if (!fs.existsSync(DOC)) {
  console.log(`  (report doc not found at ${DOC} — run creates it from the template; skipping regen)`);
  process.exit(0);
}

let md = fs.readFileSync(DOC, "utf8");
md = replaceBlock(md, "CHECKPOINT", checkpointTable());
md = replaceBlock(md, "CAPTURED", capturedSection());
md = replaceBlock(md, "SKIPPED", skippedSection());
fs.writeFileSync(DOC, md);

const done = [...phaseData.values()];
const totals = done.reduce((a, d) => ({ pass: a.pass + d.pass, fail: a.fail + d.fail, skip: a.skip + d.skipped }), { pass: 0, fail: 0, skip: 0 });
console.log(`Report updated: ${phaseData.size}/${PHASES.length} phases have results — ${totals.pass} pass, ${totals.fail} fail, ${totals.skip} skip.`);

// AP Real Estate / Horizon Dreams portfolio import — staged CLI, dry run by default.
//
//   node --env-file=.env.local import/run.mjs                  # parse -> normalize -> contracts -> diff (dry run)
//   node --env-file=.env.local import/run.mjs --no-db          # stop after normalize (no DB access)
//   node --env-file=.env.local import/run.mjs --skip-download  # use cached PDFs only
//   node --env-file=.env.local import/run.mjs --commit         # apply the diff
//   node --env-file=.env.local import/run.mjs --commit --images  # also import property images
//   flags: --file <xlsx>  --tenant <uuid>  --precedence sheet
//
// Artifacts land in import/out/: raw.json, graph.json, contracts.json,
// diff.json, apply.json and import_report.md.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SOURCE_FILE, OUT_DIR, DEFAULT_TENANT_ID } from "./config.mjs";
import { parseWorkbook } from "./lib/parse.mjs";
import { buildGraph } from "./lib/normalize.mjs";
import { runContractStage } from "./lib/contracts.mjs";
import { adminClient, fetchSystemState } from "./lib/db.mjs";
import { runDiff } from "./lib/diff.mjs";
import { runApply } from "./lib/apply.mjs";
import { runImagesStage } from "./lib/images.mjs";
import { buildReport } from "./lib/report.mjs";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}
const has = (name) => process.argv.includes(`--${name}`);

const save = (name, data) => {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 2));
  console.log(`  wrote ${path.join(OUT_DIR, name)}`);
};

async function main() {
  const file = arg("file", SOURCE_FILE);
  // NOTE: deliberately NOT process.env.TENANT_ID — that points at the dev seed
  // tenant ("Truehold"). The AP/Horizon data lives under DEFAULT_TENANT_ID.
  const tenantId = arg("tenant", DEFAULT_TENANT_ID);
  const commit = has("commit");
  const noDb = has("no-db");
  const precedence = arg("precedence", "report");

  console.log(`\n=== Stage 1: parse ${file} ===`);
  const parsed = parseWorkbook(file);
  console.log(`  tabs: ${parsed.tabs.join(", ")}`);
  console.log(`  AP rows: ${parsed.portfolio.sections.ap.length}, Horizon rows: ${parsed.portfolio.sections.horizon.length} (header verified: ${parsed.portfolio.headerVerified})`);
  save("raw.json", parsed);

  console.log(`\n=== Stage 2: normalize & validate ===`);
  const graph = buildGraph(parsed);
  console.log(`  ${JSON.stringify(graph.counts)}`);
  save("graph.json", graph);

  console.log(`\n=== Stage 3: contract PDF extraction ===`);
  const contracts = await runContractStage(graph, { skipDownload: has("skip-download") });
  console.log(`  PDFs processed: ${contracts.results.length}, manual-entry tenancies: ${contracts.manualEntry.length}`);
  save("contracts.json", contracts);
  save("graph.json", graph); // tenancies now carry startDate

  let diff = null, system = null, applyResult = null, imagesResult = null;
  let meta = { tenantId, tenantName: null };

  if (!noDb) {
    console.log(`\n=== Stage 4: fetch current state & diff (tenant ${tenantId}) ===`);
    const sb = adminClient();
    system = await fetchSystemState(sb, tenantId);
    meta.tenantName = system.tenantName;
    console.log(`  tenant "${system.tenantName}", import_ref ready: ${system.importRefReady}`);
    console.log(`  system: ${system.properties.length} properties, ${system.units.length} units, ${system.pmTenants.length} pm_tenants, ${system.contracts.length} contracts, ${system.keys.length} keys`);
    diff = runDiff(graph, system, { precedence });
    console.log(`  summary: ${JSON.stringify(diff.summary)}`);
    console.log(`  planned ops: ${diff.ops.length}, review items: ${diff.review.length}`);
    save("diff.json", diff);

    console.log(`\n=== Stage 5: apply ${commit ? "(COMMIT)" : "(dry run)"} ===`);
    const blockingNow = graph.issues.filter((i) => i.severity === "blocking");
    if (commit && blockingNow.length && !has("force")) {
      console.log(`  REFUSING to commit: ${blockingNow.length} blocking issue(s) — fix them or rerun with --force.`);
      applyResult = {
        committed: false, planned: diff.ops.length,
        log: [{ level: "warn", message: `--commit refused: ${blockingNow.length} blocking issue(s) (use --force to override)` }],
      };
    } else {
      applyResult = await runApply(sb, diff, { commit });
    }
    for (const l of applyResult.log.slice(0, 20)) console.log(`  [${l.level}] ${l.message}`);
    if (applyResult.log.length > 20) console.log(`  ... ${applyResult.log.length - 20} more (see report)`);
    save("apply.json", applyResult);

    if (has("images")) {
      console.log(`\n=== Stage 6: property images ${commit ? "(COMMIT)" : "(dry run)"} ===`);
      imagesResult = await runImagesStage(sb, graph, diff, system, { commit });
      console.log(`  planned: ${imagesResult.planned.length}${imagesResult.uploaded != null ? `, uploaded: ${imagesResult.uploaded}` : ""}`);
      save("images.json", imagesResult);
    }
  } else {
    console.log(`\n(--no-db: skipping fetch/diff/apply)`);
  }

  const report = buildReport({ parsed, graph, contracts, diff, applyResult, meta });
  const reportPath = path.join(OUT_DIR, "import_report.md");
  writeFileSync(reportPath, report);
  console.log(`\nReport: ${reportPath}`);

  const blocking = graph.issues.filter((i) => i.severity === "blocking");
  if (blocking.length) {
    console.log(`\n⚠ ${blocking.length} BLOCKING issue(s) — see report.`);
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(`\nFATAL: ${e.stack ?? e}`);
  process.exitCode = 1;
});

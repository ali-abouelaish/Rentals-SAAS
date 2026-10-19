// p13 — Mobile regression (READ-ONLY). Runs the existing mobile gates:
//   - e2e/mobile-audit.mjs: horizontal-overflow + tap-target audit, all PM routes
//     at 360/390/414px (hard-fails on overflow).
//   - e2e/mobile-dialog-audit.mjs: dialog/drawer mobile layout audit.
// Both open their own browsers; run sequentially to avoid dev-server contention.
//
//   node e2e/pm/p13-mobile.mjs

import { spawnSync } from "node:child_process";
import { check, summary, writeResults } from "./lib/pm.mjs";

console.log("\np13 — Mobile regression (read-only)\n");

function run(id, title, script) {
  return check(id, title, async () => {
    const r = spawnSync("node", [`e2e/${script}`], { cwd: process.cwd(), encoding: "utf8", timeout: 480_000 });
    const out = (r.stdout || "") + (r.stderr || "");
    const tail = out
      .split("\n")
      .filter((l) => /overflow|fail|pass|undersized|OK|clean|✓|✗|audited|routes/i.test(l))
      .slice(-3)
      .join(" | ");
    return { pass: r.status === 0, detail: `exit ${r.status}${tail ? ` — ${tail.slice(0, 200)}` : ""}` };
  });
}

await run("13.1", "mobile layout audit (no horizontal overflow)", "mobile-audit.mjs");
await run("13.2", "mobile dialog/drawer audit", "mobile-dialog-audit.mjs");

const result = summary("p13");
writeResults("p13", result, null);
process.exit(result.fail > 0 ? 1 : 0);

// p12 — Tenant isolation (READ-ONLY). The most important phase: RLS is the only
// tenant boundary, so "a test-tenant user cannot reach another tenant's rows" is
// the one invariant that, if broken, is a breach. Any foreign data rendering is
// CRITICAL. Also re-runs the existing isolation/API/cron sweeps.
//
//   node e2e/pm/p12-isolation.mjs

import { spawnSync } from "node:child_process";
import {
  openSignedIn,
  openAnonymous,
  url,
  check,
  summary,
  attachErrorCapture,
  shot,
  writeResults,
} from "./lib/pm.mjs";

// Foreign-tenant ids from the round-2 fixtures (belong to another agency).
const FOREIGN = {
  property: "bb100000-0000-4000-8000-000000000003",
  unit: "bb300002-0000-4000-8000-000000000001",
  contract: "e1ff404d-49f5-4bbb-bac0-19a029f3b7bf",
};
// Markers that only appear if a populated foreign record actually rendered.
const POPULATED = [/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/, /rent\s*£\s*[\d,]+/i, /tenancy start/i, /deposit\s*£/i];

const { browser, page } = await openSignedIn();
const cap = attachErrorCapture(page, "p12");

async function denies(id, title, pathname) {
  await check(id, `${title} must deny — ${pathname}`, async () => {
    cap.tag(id, pathname);
    const res = await page.goto(url(pathname), { waitUntil: "networkidle" }).catch(() => null);
    const status = res?.status() ?? 0;
    const landed = new URL(page.url()).pathname;
    const body = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
    const notFound = status === 404 || /not found|doesn.t exist|no longer available|404/i.test(body);
    const redirected = landed !== pathname;
    const leaked = POPULATED.some((re) => re.test(body)) && !notFound && !redirected;
    if (leaked) await shot(page, `LEAK-${id}`);
    return {
      pass: !leaked,
      detail: leaked
        ? `LEAK: foreign data rendered (HTTP ${status}, at ${landed})`
        : `denied (HTTP ${status}${redirected ? `, → ${landed}` : notFound ? ", not-found" : ""})`,
    };
  });
}

console.log("\np12 — Tenant isolation (read-only)\n");
console.log("Signed in as the test tenant; every id below belongs to another tenant.\n");

try {
  // Foreign-id PM routes (signed in as test).
  await denies("12.1", "foreign property detail", `/properties/${FOREIGN.property}`);
  await denies("12.2", "foreign property edit", `/properties/${FOREIGN.property}/edit`);
  await denies("12.3", "foreign property setup", `/properties/${FOREIGN.property}/setup`);
  await denies("12.4", "foreign profitability", `/profitability/${FOREIGN.property}`);
  await denies("12.5", "foreign contract via tenants route", `/tenants/${FOREIGN.contract}/reminders`);
  await denies("12.6", "foreign owner detail", `/owners/${FOREIGN.property}`);

  // Document API routes with a foreign id — signed in as test (RLS → not found).
  await check("12.7", "GET /api/contracts/{foreign}/document denies (signed-in)", async () => {
    const res = await page.context().request.get(url(`/api/contracts/${FOREIGN.contract}/document`), { maxRedirects: 0, failOnStatusCode: false });
    const s = res.status();
    return { pass: s === 404 || s === 403 || s === 401, detail: `HTTP ${s} (expect 404/403/401)` };
  });
  await check("12.8", "GET /api/properties/{foreign}/contract-document denies (signed-in)", async () => {
    const res = await page.context().request.get(url(`/api/properties/${FOREIGN.property}/contract-document`), { maxRedirects: 0, failOnStatusCode: false });
    const s = res.status();
    return { pass: s === 404 || s === 403 || s === 401, detail: `HTTP ${s} (expect 404/403/401)` };
  });

  // Same document routes, ANONYMOUS — must never serve a document.
  await check("12.9", "document APIs deny anonymous callers", async () => {
    const { browser: anon, context } = await openAnonymous();
    try {
      const a = await context.request.get(url(`/api/contracts/${FOREIGN.contract}/document`), { maxRedirects: 0, failOnStatusCode: false });
      const b = await context.request.get(url(`/api/properties/${FOREIGN.property}/contract-document`), { maxRedirects: 0, failOnStatusCode: false });
      const ok = [a.status(), b.status()].every((s) => s === 401 || s === 403 || s === 404);
      return { pass: ok, detail: `contracts=${a.status()}, properties=${b.status()} (expect 401/403/404)` };
    } finally {
      await anon.close();
    }
  });

  // Close our browser BEFORE spawning the sweeps — each opens its own browser,
  // and running them concurrently contends on the single-threaded dev server
  // (transient 5xx that falsely trips the sweep). Run them standalone instead.
  await browser.close();

  for (const [id, title, script] of [
    ["12.10", "e2e/phase9-isolation.mjs passes", "phase9-isolation.mjs"],
    ["12.11", "e2e/phase12-sweeps.mjs passes (API + cron auth)", "phase12-sweeps.mjs"],
  ]) {
    await check(id, title, async () => {
      const r = spawnSync("node", [`e2e/${script}`], { cwd: process.cwd(), encoding: "utf8" });
      const pass = r.status === 0;
      const tail = (r.stdout || "").split("\n").filter((l) => /passed|failed|LEAK/i.test(l)).slice(-2).join(" | ");
      return { pass, detail: `exit ${r.status} — ${tail}` };
    });
  }

  const result = summary("p12");
  writeResults("p12", result, cap);
  process.exit(result.fail > 0 ? 1 : 0);
} catch (err) {
  console.error("p12 error:", err.message);
  await browser.close().catch(() => {});
  const result = summary("p12");
  writeResults("p12", result, cap);
  process.exit(1);
}

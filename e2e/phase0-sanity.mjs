// Phase 0 — Sanity.
//
// Plan step 1: confirm run 1's preserved records are still present before any
// later phase leans on them. Every subsequent phase reuses these fixtures, so a
// missing one here explains failures downstream that would otherwise look like
// new bugs.
//
//   node e2e/phase0-sanity.mjs

import { openSession, url, check, summary, shot } from "./lib/harness.mjs";

const { browser, page } = await openSession();

/** Land on a page and return its rendered text, or throw with the real reason. */
async function textOf(pathname) {
  const res = await page.goto(url(pathname), { waitUntil: "networkidle" });
  const status = res?.status() ?? 0;
  const landed = new URL(page.url()).pathname;
  if (landed.startsWith("/login")) {
    throw new Error("bounced to /login — saved session expired, re-run e2e/login.mjs");
  }
  if (status >= 400) throw new Error(`HTTP ${status} on ${pathname}`);
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

console.log("\nPhase 0 — Sanity (preserved run-1 records)\n");

await check("1a", "/properties lists E2E-Test House", async () => {
  const body = await textOf("/properties");
  return {
    pass: body.includes("E2E-Test House"),
    detail: body.includes("E2E-Test House") ? "" : "not found on /properties",
  };
});

await check("1b", "/bookings lists Anna (approved) and Bob (pending)", async () => {
  const body = await textOf("/bookings");
  const anna = body.includes("Anna");
  const bob = body.includes("Bob");
  return {
    pass: anna && bob,
    detail: `Anna=${anna} Bob=${bob}`,
  };
});

await check("1c", "/contracts shows Anna's contract in Notice Given", async () => {
  const body = await textOf("/contracts");
  const anna = body.includes("Anna");
  const notice = /notice given/i.test(body);
  return {
    pass: anna && notice,
    detail: `Anna=${anna} noticeGiven=${notice}`,
  };
});

await check("1d", "/landlords reachable (CRM list renders)", async () => {
  const body = await textOf("/landlords");
  return { pass: body.length > 0, detail: `${body.length} chars rendered` };
});

await check("1e", "/maintenance shows the run-1 leaking tap job", async () => {
  const body = await textOf("/maintenance");
  const found = /leaking tap/i.test(body);
  return { pass: found, detail: found ? "" : "run-1 maintenance job missing" };
});

await shot(page, "phase0-contracts");

const result = summary("Phase 0");
await browser.close();
process.exit(result.fail > 0 ? 1 : 0);

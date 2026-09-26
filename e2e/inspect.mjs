// Ad-hoc inspector: dump what the signed-in session actually sees on a page.
// Used to orient a run when expected fixtures are missing — it answers "which
// tenant am I in, and what data exists?" before any phase is trusted.
//
//   node e2e/inspect.mjs /properties /bookings

import { openSession, url } from "./lib/harness.mjs";

const paths = process.argv.slice(2);
if (!paths.length) {
  console.error("usage: node e2e/inspect.mjs <path> [path...]");
  process.exit(2);
}

const { browser, page } = await openSession();

for (const p of paths) {
  const res = await page.goto(url(p), { waitUntil: "networkidle" });
  const body = (await page.locator("body").innerText()).replace(/\n{2,}/g, "\n").trim();
  console.log(`\n${"=".repeat(70)}\n${p}  (HTTP ${res?.status()}, landed ${new URL(page.url()).pathname})\n${"=".repeat(70)}`);
  console.log(body.slice(0, 1800));
}

await browser.close();

// Interactive sign-in. Opens a real browser window, waits for a human to log
// in, then saves the session so every other script runs unattended.
//
// Claude never types the password — that was a standing constraint in run 1 and
// this keeps it true while still allowing automated runs afterwards.
//
//   node e2e/login.mjs
//
// Re-run it whenever a run starts failing with redirects back to /login.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { BASE_URL, STATE_PATH, url } from "./lib/harness.mjs";

const TIMEOUT_MS = 10 * 60 * 1000;

const browser = await chromium.launch({
  headless: false,
  args: ["--window-size=1440,960"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

console.log(`Opening ${BASE_URL}/login — sign in in the browser window.`);
console.log("Waiting for you to land on a signed-in page…\n");

await page.goto(url("/login"), { waitUntil: "domcontentloaded" });

const deadline = Date.now() + TIMEOUT_MS;
let signedIn = false;

while (Date.now() < deadline) {
  await page.waitForTimeout(1000);

  let current;
  try {
    current = new URL(page.url());
  } catch {
    continue;
  }

  const onAuthPage = /^\/(login|signup|forgot-password|reset-password|auth)/.test(
    current.pathname
  );
  if (onAuthPage) continue;

  // Off the auth pages is necessary but not sufficient — a redirect can land on
  // the marketing root. Require a Supabase auth cookie too.
  const cookies = await context.cookies();
  const hasAuth = cookies.some((c) => /^sb-.*-auth-token/.test(c.name) && c.value);
  if (hasAuth) {
    signedIn = true;
    break;
  }
}

if (!signedIn) {
  console.error("\nTimed out waiting for sign-in. Nothing saved.");
  await browser.close();
  process.exit(1);
}

fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
await context.storageState({ path: STATE_PATH });

console.log(`Signed in — landed on ${page.url()}`);
console.log(`Session saved to ${STATE_PATH}`);
console.log("\nThat file holds live auth cookies. It is gitignored; do not commit it.");
console.log("Next: node e2e/phase0-sanity.mjs");

await browser.close();

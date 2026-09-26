// Shared plumbing for the Harbor Ops browser E2E runs.
//
// Two rules shape this file:
//
//   1. Claude never handles the password. The login step opens a headed browser
//      and waits for a human to sign in; the resulting cookies are saved to
//      e2e/.auth/state.json and every later script starts from that state. So a
//      run never re-authenticates, and an expired session is a re-run of
//      `login.mjs`, not a credential prompt mid-test.
//   2. A failing check records and continues. The point of a 32-step plan is
//      the whole picture, so `check()` collects results rather than throwing —
//      one broken phase must not hide the twenty steps after it.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const E2E_ROOT = path.resolve(HERE, "..");
export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const STATE_PATH = path.join(E2E_ROOT, ".auth", "state.json");
export const ARTIFACTS = path.join(E2E_ROOT, "artifacts");

// Next loads `.env.local` for the app; a plain `node e2e/…` run does not, so
// `autoLogin` would never see E2E_EMAIL/E2E_PASSWORD without this.
dotenv.config({ path: path.join(E2E_ROOT, "..", ".env.local"), quiet: true });

export function hasSavedSession() {
  return fs.existsSync(STATE_PATH);
}

/**
 * Open a browser already signed in as the saved user.
 *
 * Headless by default — the saved cookies mean there is nothing to watch. Pass
 * headed:true (or E2E_HEADED=1) when a step needs eyes on it.
 */
export async function openSession({ headed = process.env.E2E_HEADED === "1" } = {}) {
  if (!hasSavedSession()) {
    throw new Error(
      "No saved session. Run `node e2e/login.mjs` first and sign in when the browser opens."
    );
  }
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    storageState: STATE_PATH,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  return { browser, context, page };
}

/** A plain (signed-out) context, for public pages and isolation probes. */
export async function openAnonymous({ headed = false } = {}) {
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  return { browser, context, page };
}

/**
 * Sign in without a human, when the account is one we are allowed to automate.
 *
 * Reads `E2E_EMAIL` / `E2E_PASSWORD` from the environment (`.env.local`, which
 * is gitignored). The password is passed straight from `process.env` into
 * Playwright's `fill()` — it is never logged, echoed, or returned, and no
 * caller ever sees it.
 *
 * Returns false when no credentials are configured, so callers can fall back to
 * telling the user to run `login.mjs` by hand rather than failing outright.
 */
export async function autoLogin(context, page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) return false;

  // Retry with backoff. A single attempt is not enough: Supabase throttles
  // repeated sign-ins, so a burst of them (a sweep that kept bouncing, say)
  // can get one attempt refused even though the credentials are fine.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await page.waitForTimeout(3_000 * attempt);
    try {
      await page.goto(url("/login"), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.fill("#login-email", email);
      await page.fill("#login-password", password);
      await Promise.all([
        page.waitForURL((u) => !new URL(u).pathname.startsWith("/login"), { timeout: 30_000 }),
        page.click('button[type="submit"]'),
      ]).catch(() => {});

      const cookies = await context.cookies();
      const signedIn =
        !new URL(page.url()).pathname.startsWith("/login") &&
        cookies.some((c) => /^sb-.*-auth-token/.test(c.name) && c.value);

      if (signedIn) {
        await persistSession(context);
        return true;
      }
      const shown = await page
        .locator("body")
        .innerText()
        .then((t) => t.replace(/\s+/g, " ").slice(0, 120))
        .catch(() => "");
      console.log(`  (sign-in attempt ${attempt + 1} did not take${shown ? ` — page said: ${shown}` : ""})`);
    } catch (err) {
      console.log(`  (sign-in attempt ${attempt + 1} failed: ${err.message.split("\n")[0]})`);
    }
  }
  return false;
}

/**
 * Write the browser's current cookies back over the saved session.
 *
 * Supabase rotates refresh tokens: the moment the app refreshes an access
 * token, the refresh token that was used is spent. `state.json` was only ever
 * read, never written, so the snapshot still held the spent token and the next
 * run an hour later was logged out — which is why sign-in kept having to be
 * repeated, and why three full audit sweeps died half-finished.
 *
 * Call this before closing the browser and the saved session rolls forward
 * with each run instead of decaying.
 */
export async function persistSession(context) {
  try {
    await context.storageState({ path: STATE_PATH });
    return true;
  } catch {
    // A failure here must never fail the run that just succeeded.
    return false;
  }
}

export function url(pathname) {
  return new URL(pathname, BASE_URL).toString();
}

// ---------------------------------------------------------------------------
// Tenant guard
// ---------------------------------------------------------------------------

/**
 * The write phases are authorised for ONE agency, and the database they run
 * against also holds live ones. A run that starts against the wrong tenant
 * creates real bookings and deletes real records, so every writing script calls
 * this first and refuses to continue rather than trusting whoever last ran
 * login.mjs. (A round-2 sanity run on 2026-09-15 did land in the live Truehold
 * agency — this exists so that cannot reach a phase that writes.)
 */
/**
 * Verify the tenant by identity, not by what the sidebar happens to say.
 *
 * `assertTestTenant` below matches the page text against EXPECTED_TENANT, and
 * "Property Co." is the hardcoded fallback brand in SideNav.tsx for any PM
 * tenant with no brand_name set. Both "Test Tenant" and "Demo Agency" render
 * it, so the text check cannot tell them apart — it blocks Truehold (what it
 * was written for) but would happily let a writing run into Demo Agency.
 *
 * This resolves the signed-in account to its actual `tenants.slug` and refuses
 * anything else. Any script that WRITES should call this, not the text check.
 */
export const EXPECTED_TENANT_SLUG = process.env.E2E_TENANT_SLUG ?? "test";

export async function assertWritableTenant() {
  const { createClient } = await import("@supabase/supabase-js");
  // Not named `url` — that is the exported helper, and shadowing it here would
  // quietly break any later use inside this function.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.E2E_EMAIL;
  if (!supabaseUrl || !key || !email) {
    throw new Error(
      "REFUSING TO WRITE: need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and E2E_EMAIL to verify the tenant."
    );
  }
  const db = createClient(supabaseUrl, key, { auth: { persistSession: false } });
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const user = users?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error("REFUSING TO WRITE: the E2E account does not exist.");
  const { data: profile } = await db
    .from("user_profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  const { data: tenant } = await db
    .from("tenants")
    .select("id,name,slug")
    .eq("id", profile?.tenant_id)
    .maybeSingle();
  if (!tenant || tenant.slug !== EXPECTED_TENANT_SLUG) {
    throw new Error(
      `REFUSING TO WRITE: the E2E account belongs to "${tenant?.name ?? "unknown"}" ` +
        `(slug=${tenant?.slug ?? "?"}), not the expected slug "${EXPECTED_TENANT_SLUG}".`
    );
  }
  console.log(`Write guard OK — "${tenant.name}" (slug=${tenant.slug}, ${tenant.id}).`);
  return { db, tenant };
}

export const EXPECTED_TENANT = process.env.E2E_TENANT ?? "Property Co.";

export async function assertTestTenant(page) {
  const res = await page.goto(url("/dashboard"), { waitUntil: "networkidle" });
  if (new URL(page.url()).pathname.startsWith("/login")) {
    throw new Error("Not signed in — run `node e2e/login.mjs`.");
  }
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  if (!body.includes(EXPECTED_TENANT)) {
    const shown = body.slice(0, 200);
    throw new Error(
      `REFUSING TO RUN: expected the "${EXPECTED_TENANT}" agency but the session is ` +
        `somewhere else (HTTP ${res?.status()}). Re-run e2e/login.mjs and sign in as the ` +
        `test tenant, or set E2E_TENANT deliberately.\nPage began: ${shown}`
    );
  }
  console.log(`Tenant guard OK — signed in to "${EXPECTED_TENANT}".`);
  return EXPECTED_TENANT;
}

// ---------------------------------------------------------------------------
// Result collection
// ---------------------------------------------------------------------------

const results = [];

/**
 * Record one plan step. `pass` may be a boolean or a thrown-safe async fn.
 * Never throws: a step that blows up is a FAIL with the error attached, so the
 * run keeps going.
 */
export async function check(id, title, fn) {
  let pass = false;
  let detail = "";
  try {
    const outcome = await fn();
    if (outcome && typeof outcome === "object") {
      pass = Boolean(outcome.pass);
      detail = outcome.detail ?? "";
    } else {
      pass = Boolean(outcome);
    }
  } catch (err) {
    pass = false;
    detail = `threw: ${err instanceof Error ? err.message : String(err)}`;
  }
  results.push({ id, title, pass, detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${id}. ${title}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

/** Record a step that needs a human (or a later phase) — neither pass nor fail. */
export function skip(id, title, why) {
  results.push({ id, title, pass: null, detail: why });
  console.log(`  [SKIP] ${id}. ${title} — ${why}`);
}

export function summary(phaseName) {
  const pass = results.filter((r) => r.pass === true).length;
  const fail = results.filter((r) => r.pass === false).length;
  const skipped = results.filter((r) => r.pass === null).length;
  console.log(`\n${phaseName}: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  if (fail) {
    console.log("\nFailures:");
    for (const r of results.filter((x) => x.pass === false)) {
      console.log(`  - ${r.id}. ${r.title}${r.detail ? ` — ${r.detail}` : ""}`);
    }
  }
  return { pass, fail, skipped, results: [...results] };
}

export async function shot(page, name) {
  const file = path.join(ARTIFACTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

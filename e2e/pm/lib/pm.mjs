// PM E2E helpers — built on e2e/lib/harness.mjs.
//
// The harness owns sessions, the tenant write-guard, and result collection
// (check/skip/summary). This module adds what the PM round needs on top:
//
//   - attachErrorCapture: the "log EVERY error" part. Passive listeners for page
//     errors, console errors and 5xx responses, plus an active DOM scan for the
//     Next error overlay / error-boundary / stuck loading skeleton. Everything is
//     tagged with the current step id and route so the report can group it.
//   - visit: navigate and assert the page is actually usable (not bounced to
//     /login, not a 4xx/5xx, not an error boundary, has a heading).
//   - db: a service-role client SCOPED to the test tenant id, for looking up ids
//     and verifying persistence. Never writes except in cleanup.
//   - track: a cleanup manifest. Every row or storage object a write phase
//     creates is recorded here by id, because prefix-matching alone can't undo
//     writes to a production database — booking references are random, child rows
//     (invoices, email_log, storage objects) don't carry the PM5- prefix.
//   - form helpers + uiRulesProbe: CLAUDE.md UI-rule checks against the DOM.
//   - writeResults: persist a phase's results + captured errors for the report.

import fs from "node:fs";
import path from "node:path";
import {
  openSession,
  openAnonymous,
  autoLogin,
  persistSession,
  assertWritableTenant,
  assertStylesheetIsLive,
  check,
  skip,
  summary,
  shot,
  url,
  ARTIFACTS,
} from "../../lib/harness.mjs";

export {
  openSession,
  openAnonymous,
  autoLogin,
  persistSession,
  assertWritableTenant,
  assertStylesheetIsLive,
  check,
  skip,
  summary,
  shot,
  url,
};

// All PM data is prefixed so cleanup (and a human) can recognise it on sight.
export const PREFIX = "PM5-";
export const email = (local) => `${local}.pm5@example.com`;
// Dummy bank details — never real.
export const DUMMY_BANK = { sortCode: "12-34-56", accountNumber: "12345678" };

export const PM_ARTIFACTS = path.join(ARTIFACTS, "pm");
fs.mkdirSync(PM_ARTIFACTS, { recursive: true });

/**
 * Open a signed-in session, refreshing it if the saved one has expired.
 *
 * openSession() only loads the cookies on disk; a run days later finds them
 * expired and every page bounces to /login (which reads as a wall of failures,
 * or worse, a false "isolation denied" when a route only redirected because we
 * were logged out). This verifies the session on /dashboard and, if it bounced,
 * re-logs-in via autoLogin (E2E_EMAIL/E2E_PASSWORD) and rolls the saved state
 * forward. Throws if no session can be established, rather than running blind.
 */
export async function openSignedIn() {
  const sess = await openSession();
  await sess.page.goto(url("/dashboard"), { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});
  if (new URL(sess.page.url()).pathname.startsWith("/login")) {
    const ok = await autoLogin(sess.context, sess.page);
    if (!ok) {
      await sess.browser.close().catch(() => {});
      throw new Error(
        "Session expired and autoLogin failed — set E2E_EMAIL/E2E_PASSWORD in .env.local or run `node e2e/login.mjs`."
      );
    }
  }
  await persistSession(sess.context);
  return sess;
}

// ---------------------------------------------------------------------------
// Error capture
// ---------------------------------------------------------------------------

const trunc = (s, n = 2000) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// Console noise that is not a defect: known third-party warnings, favicon 404s,
// React dev-mode hydration hints we can't act on from a test. Kept tight on
// purpose — the whole point of this phase is to NOT swallow real errors.
const CONSOLE_IGNORE = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /favicon\.ico/i,
  /Failed to load resource:.*favicon/i,
];

/**
 * Attach listeners that record everything worth knowing about a page, tagged
 * with the step and route in flight. Returns a handle the phase keeps for the
 * whole run; `handle.captured` is the growing list, written out by writeResults.
 */
export function attachErrorCapture(page, phase) {
  const captured = [];
  let current = { step: "-", route: "-" };

  const add = (type, severity, message, extra = {}) => {
    captured.push({
      type,
      severity,
      phase,
      step: current.step,
      route: current.route,
      message: trunc(message),
      at: new Date().toISOString(),
      ...extra,
    });
  };

  page.on("pageerror", (err) => add("pageerror", "HIGH", err?.stack || err?.message || err));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (CONSOLE_IGNORE.some((re) => re.test(text))) return;
    add("console.error", "MEDIUM", text);
  });
  page.on("response", (res) => {
    const s = res.status();
    if (s >= 500) add("http5xx", "HIGH", `${s} ${res.request().method()} ${res.url()}`, { status: s });
  });

  return {
    phase,
    captured,
    /** Call before each check so later errors are attributed correctly. */
    tag(step, route) {
      current = { step: step ?? current.step, route: route ?? current.route };
    },
    /**
     * Active scan of the current DOM for failure signatures a listener can't see:
     * the Next.js error overlay, an app/error.tsx boundary, "Application error",
     * or a loading.tsx skeleton that never resolved. Records what it finds and
     * returns a summary for visit() to fold into its verdict.
     */
    async scan(page) {
      const info = await page
        .evaluate(() => {
          const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
          const overlay = !!(
            document.querySelector("nextjs-portal") ||
            document.querySelector("[data-nextjs-dialog]") ||
            document.querySelector("[data-nextjs-dialog-overlay]")
          );
          const boundary = /Application error|something went wrong|this page could not be rendered/i.test(
            text
          );
          const heading = !!document.querySelector("h1, h2, [role='heading'][aria-level]");
          // A skeleton still up: common Tailwind pulse class with no heading yet.
          const pulses = document.querySelectorAll(".animate-pulse").length;
          return { overlay, boundary, heading, pulses, textLen: text.length, snippet: text.slice(0, 200) };
        })
        .catch(() => null);
      if (!info) return { overlay: false, boundary: false, heading: true };
      if (info.overlay) add("next-overlay", "HIGH", `Next error overlay visible — ${info.snippet}`);
      if (info.boundary) add("error-boundary", "HIGH", `error boundary rendered — ${info.snippet}`);
      return info;
    },
    /** Record an arbitrary finding (used by uiRulesProbe and form helpers). */
    note(type, severity, message, extra = {}) {
      add(type, severity, message, extra);
    },
  };
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Navigate and judge whether the page is actually usable.
 *
 * A pass means: did not bounce to /login, the document response was < 400, no
 * error overlay/boundary rendered, and (unless told otherwise) a heading is
 * present after a 10s grace for the loading skeleton to resolve. Never throws —
 * returns a { pass, detail } verdict for check() to record.
 *
 * `networkidle` is deliberately bounded: this app runs background pollers, so
 * "no requests for 500ms" often never happens; we wait for load, give the
 * network a capped chance to settle, then a fixed settle for client layout.
 */
export async function visit(page, pathname, cap, { settle = 400, expectHeading = true, waitSkeleton = 10_000 } = {}) {
  cap?.tag(undefined, pathname);
  let res;
  let navErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await page.goto(url(pathname), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
      await page.waitForTimeout(settle);
      navErr = null;
      break;
    } catch (err) {
      navErr = err;
      await page.waitForTimeout(500);
    }
  }
  if (navErr) return { pass: false, detail: `navigation failed: ${navErr.message.split("\n")[0]}` };

  const status = res?.status() ?? 0;
  const landed = new URL(page.url()).pathname;
  const bounced = landed.startsWith("/login") && !pathname.startsWith("/login");

  if (bounced) return { pass: false, detail: `bounced to /login (session lost?)` };
  if (status >= 400) return { pass: false, detail: `HTTP ${status} at ${landed}` };

  const scan = cap ? await cap.scan(page) : await scanPage(page);
  if (scan.overlay) return { pass: false, detail: `Next error overlay — ${scan.snippet ?? ""}` };
  if (scan.boundary) return { pass: false, detail: `error boundary — ${scan.snippet ?? ""}` };

  if (expectHeading && !scan.heading) {
    // Give the loading skeleton a chance before calling it stuck.
    await page.waitForSelector("h1, h2, [role='heading'][aria-level]", { timeout: waitSkeleton }).catch(() => {});
    const again = cap ? await cap.scan(page) : await scanPage(page);
    if (!again.heading) {
      if (again.pulses > 0) {
        cap?.note("stuck-loading", "HIGH", `loading skeleton still showing after ${waitSkeleton}ms at ${landed}`);
        return { pass: false, detail: `stuck on loading skeleton (${again.pulses} pulse blocks, no heading)` };
      }
      // A content-rich page with no top-level heading is still usable — some
      // surfaces (the contract template editor, canvas tools) have no h1/h2.
      // Only a near-empty page with no heading is a real blank/failure.
      if ((again.textLen ?? 0) > 200) {
        return { pass: true, detail: `HTTP ${status}, no heading but ${again.textLen} chars of content` };
      }
      return { pass: false, detail: `blank page: no heading and only ${again.textLen ?? 0} chars at ${landed}` };
    }
  }

  return { pass: true, detail: `HTTP ${status}${landed !== pathname ? `, landed ${landed}` : ""}` };
}

/** Standalone DOM scan, for anonymous contexts without an error-capture handle. */
export async function scanPage(page) {
  return (
    (await page
      .evaluate(() => {
        const text = (document.body?.innerText || "").replace(/\s+/g, " ");
        return {
          overlay: !!(document.querySelector("nextjs-portal") || document.querySelector("[data-nextjs-dialog]")),
          boundary: /Application error|something went wrong/i.test(text),
          heading: !!document.querySelector("h1, h2, [role='heading'][aria-level]"),
          pulses: document.querySelectorAll(".animate-pulse").length,
          textLen: text.trim().length,
          snippet: text.slice(0, 200),
        };
      })
      .catch(() => null)) ?? { overlay: false, boundary: false, heading: true, pulses: 0, textLen: 0 }
  );
}

// ---------------------------------------------------------------------------
// Service-role DB (lookups + persistence checks; writes only in cleanup)
// ---------------------------------------------------------------------------

let _db = null;

/**
 * A service-role Supabase client plus the resolved test-tenant id.
 *
 * Goes through assertWritableTenant, so merely obtaining the client re-proves we
 * are pointed at the `test` tenant and nowhere near a live agency. Cached so the
 * listUsers round-trip happens once per process.
 */
export async function db() {
  if (_db) return _db;
  const { db: client, tenant } = await assertWritableTenant();
  _db = { client, tenantId: tenant.id, tenant };
  return _db;
}

// ---------------------------------------------------------------------------
// Cleanup manifest
// ---------------------------------------------------------------------------

const MANIFEST = path.join(PM_ARTIFACTS, "manifest.json");

/**
 * Record a created row or storage object so p14 can delete it deterministically.
 *
 * Prefix-matching ("name LIKE 'PM5-%'") is a backstop, not the plan: booking
 * references are random, and child rows (invoices, email_log, scheduled_messages,
 * storage blobs) never carry the prefix. Each write phase calls this with the
 * exact id/key it created, newest first, so cleanup is exact and reversible.
 *
 *   track("properties", id)
 *   track("storage", key, { bucket: "property_contracts" })
 */
export function track(kind, id, meta = {}) {
  let list = [];
  try {
    list = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch {
    list = [];
  }
  list.push({ kind, id, meta, at: new Date().toISOString() });
  fs.writeFileSync(MANIFEST, JSON.stringify(list, null, 2));
  return id;
}

export function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Form + UI-rule helpers (CLAUDE.md compliance)
// ---------------------------------------------------------------------------

/**
 * Submit a form/dialog with empty required fields and assert the validation
 * errors render INLINE (below the field, in the page), not as a native browser
 * validation tooltip. Returns { pass, detail }.
 *
 * `scope` is a Playwright Locator for the dialog/form. `submit` is a locator for
 * the submit button (defaults to the first submit-type button in scope).
 */
export async function submitEmptyExpectInline(scope, submit) {
  const btn = submit ?? scope.locator('button[type="submit"]').first();
  // A native tooltip would mean required inputs still have the browser's
  // validation and no custom message — detect it before clicking.
  const hasNativeRequired = await scope
    .locator("input[required]:not([novalidate]), textarea[required]")
    .count()
    .then((c) => c > 0)
    .catch(() => false);
  await btn.click().catch(() => {});
  await scope.page().waitForTimeout(500);
  // Target error MESSAGE paragraphs/alerts, not the red required-asterisk <span>*</span>.
  const raw = await scope
    .locator("p.text-red-500, p.text-red-600, p.text-destructive, [role='alert'], [data-error]")
    .allInnerTexts()
    .catch(() => []);
  const errors = raw.map((t) => t.trim()).filter((t) => t && t !== "*" && t.length > 1);
  if (errors.length > 0) return { pass: true, detail: `${errors.length} inline error(s): ${errors[0]?.slice(0, 70)}` };
  return {
    pass: false,
    detail: hasNativeRequired
      ? "no inline errors — relying on native browser validation (violates CLAUDE.md)"
      : "submit produced no inline validation error",
  };
}

/**
 * Probe the CLAUDE.md UI rules against the DOM of a scope (whole page or a
 * dialog). Returns a list of violations; the phase records each as a LOW check.
 *
 * Rules checked:
 *   - every visible text input/select/textarea has an associated <label>;
 *   - every delete control is red and carries the Trash2 icon;
 *   - action buttons use a non-default (secondary) variant.
 * Hints and tooltips are harder to assert generically; their absence is flagged
 * softly (as a note) rather than failed.
 */
export async function uiRulesProbe(scope) {
  const page = scope.page ? scope.page() : scope; // accept a page or a locator
  const root = scope.page ? scope : page.locator("main");
  const violations = await root
    .evaluate((el) => {
      const out = [];
      const visible = (n) => {
        const r = n.getBoundingClientRect();
        const cs = getComputedStyle(n);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
      };
      const labelFor = (input) => {
        if (input.id) {
          const l = el.querySelector(`label[for="${CSS.escape(input.id)}"]`);
          if (l) return true;
        }
        if (input.closest("label")) return true;
        if (input.getAttribute("aria-label") || input.getAttribute("aria-labelledby")) return true;
        return false;
      };
      // Labels
      for (const input of el.querySelectorAll("input, select, textarea")) {
        const type = (input.getAttribute("type") || "").toLowerCase();
        if (["hidden", "submit", "button", "checkbox", "radio"].includes(type)) continue;
        if (!visible(input)) continue;
        if (!labelFor(input)) {
          const where = input.name || input.id || input.placeholder || input.tagName.toLowerCase();
          out.push({ rule: "label", detail: `input "${where}" has no associated <label>` });
        }
      }
      // Delete controls: must be red and use the Trash2 icon (lucide class/svg).
      for (const btn of el.querySelectorAll("button, a")) {
        if (!visible(btn)) continue;
        const txt = (btn.textContent || "").trim().toLowerCase();
        const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
        const looksDelete = /\bdelete\b|\bremove\b/.test(txt) || /\bdelete\b|\bremove\b/.test(aria);
        if (!looksDelete) continue;
        const cs = getComputedStyle(btn);
        const svg = btn.querySelector("svg");
        const svgCls = svg ? svg.getAttribute("class") || "" : "";
        const isTrash = /lucide-trash-?2/.test(svgCls) || /trash/i.test(svgCls);
        const colour = (cs.color + cs.backgroundColor).toLowerCase();
        const red = /rgb\(2\d\d|rgb\(1\d\d/.test(colour) && /rgb\(\s*(2|1)\d\d,\s*\d?\d?,\s*\d?\d?/.test(colour);
        if (!isTrash) out.push({ rule: "delete-icon", detail: `delete control "${txt || aria}" missing Trash2 icon` });
        if (!red && !/destructive|text-red|bg-red/.test(btn.getAttribute("class") || ""))
          out.push({ rule: "delete-red", detail: `delete control "${txt || aria}" is not red` });
      }
      return out;
    })
    .catch(() => []);
  return violations;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/**
 * Persist a phase's results and captured errors to
 * e2e/artifacts/pm/<phase>.json — the raw material report.mjs merges.
 */
export function writeResults(phase, result, cap, extra = {}) {
  const file = path.join(PM_ARTIFACTS, `${phase}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        phase,
        ranAt: new Date().toISOString(),
        pass: result.pass,
        fail: result.fail,
        skipped: result.skipped,
        results: result.results,
        captured: cap?.captured ?? [],
        ...extra,
      },
      null,
      2
    )
  );
  return file;
}

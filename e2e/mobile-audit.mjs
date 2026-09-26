// Mobile layout audit for the property management module.
//
// Answers one question per route, at phone widths: does this page fit?
//
//   node e2e/mobile-audit.mjs                       # every PM route, all widths
//   node e2e/mobile-audit.mjs properties keys       # just these routes
//   node e2e/mobile-audit.mjs --width 360           # one width
//   node e2e/mobile-audit.mjs --strict              # undersized tap targets fail too
//   node e2e/mobile-audit.mjs --shots               # write a screenshot per route
//
// Routes are given without a leading slash. Git Bash rewrites a bare
// "/properties" into a Windows path before Node ever sees the argument, so
// "properties" is the form that survives on every shell we run this from.
//
// Horizontal overflow is the hard failure: when the document is wider than the
// viewport, every element on the page gains a sideways scroll and the layout is
// broken regardless of how it looks in a screenshot. The audit reports the
// innermost element responsible rather than the fact of the overflow, because
// the outer containers are only ever reporting their child's width back.
//
// Tap targets under 44px are a warning by default — the count is the number
// worth tracking down over a phase, not a gate to clear on day one.

import fs from "node:fs";
import path from "node:path";
import { openSession, url, ARTIFACTS, BASE_URL, E2E_ROOT, persistSession, autoLogin } from "./lib/harness.mjs";

/**
 * Routes addressed by id, slug or token.
 *
 * Link-following discovery cannot reach a page its list view does not link to
 * (a form builder, a tenant's reminders), and cannot reach a public page at all.
 * `node e2e/seed-audit-fixtures.mjs` resolves — and where necessary creates —
 * one row per such route and writes the identifiers here.
 */
const FIXTURES = (() => {
  const f = path.join(E2E_ROOT, "audit-fixtures.json");
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    console.log("  (no audit-fixtures.json — run `node e2e/seed-audit-fixtures.mjs` to cover id-addressed and public routes)");
    return {};
  }
})();

function fixtureRoutes() {
  const r = [];
  if (FIXTURES.formId) r.push(`/forms/${FIXTURES.formId}`, `/forms/${FIXTURES.formId}/responses`);
  if (FIXTURES.evaluationId) r.push(`/acquisition-insights/${FIXTURES.evaluationId}`);
  if (FIXTURES.automationRuleId) r.push(`/automations/rules/${FIXTURES.automationRuleId}`);
  if (FIXTURES.inboxRequestId) r.push(`/inbox/${FIXTURES.inboxRequestId}`);
  if (FIXTURES.pmTenantId) r.push(`/tenants/${FIXTURES.pmTenantId}/reminders`);
  if (FIXTURES.contractTemplateId) r.push(`/contracts/templates/${FIXTURES.contractTemplateId}`);
  // Public, renter-facing — outside the app shell, so the probe falls back to
  // measuring the document rather than <main>.
  if (FIXTURES.formPublicSlug) r.push(`/f/${FIXTURES.formPublicSlug}`);
  if (FIXTURES.shareToken) r.push(`/s/${FIXTURES.shareToken}`);
  r.push("/portal/login");
  return r;
}

const WIDTHS = [
  { name: "360", width: 360, height: 740 }, // small Android
  { name: "390", width: 390, height: 844 }, // iPhone 14/15
  { name: "414", width: 414, height: 896 },
];

const MIN_TAP = 44;

/**
 * Every PM surface that can be reached by a fixed URL.
 *
 * Routes with an `[id]` are resolved at run time by opening the list page they
 * belong to and following its first row — hardcoded ids rot the moment the
 * test tenant is reseeded.
 */
const STATIC_ROUTES = [
  "/dashboard",
  // Lettings
  "/properties",
  "/properties/new",
  "/owners",
  "/tenants",
  "/bookings",
  "/contracts",
  "/contracts/templates",
  "/contracts/templates/new",
  // Finance
  "/rent-collection",
  "/rent-collection/statements",
  "/finances",
  "/finances/overheads",
  "/finances/tenant-charges",
  "/finances/close",
  "/profitability",
  "/deposits",
  // Growth
  "/acquisition-insights",
  "/acquisition-insights/new",
  "/shares",
  "/shares/new",
  // Forms
  "/settings/booking-forms",
  "/forms",
  // Tools
  "/maintenance",
  "/compliance",
  "/reminders",
  "/automations",
  "/automations/templates",
  "/keys",
  "/inbox",
  "/marketing",
  "/helpdesk",
  // Settings
  "/settings/team",
  "/settings/bank-details",
  "/settings/api-keys",
  "/settings/email",
  "/settings/messaging",
  "/settings/integrations",
  "/settings/deposits",
  "/settings/e-signing",
  "/settings/billing-info",
];

/**
 * Detail pages, found by following the first matching link on a list page.
 *
 * `ID` is deliberately uuid-shaped rather than `[^/]+`. A looser pattern
 * happily matches the "New property" button and audits `/properties/new/edit`,
 * a route that does not exist.
 */
const ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const DISCOVERED_ROUTES = [
  { from: "/properties", match: new RegExp(`^/properties/${ID}$`), label: "property detail" },
  { from: "/properties", match: new RegExp(`^/properties/${ID}$`), suffix: "/edit", label: "property edit" },
  { from: "/properties", match: new RegExp(`^/properties/${ID}$`), suffix: "/setup", label: "property setup" },
  { from: "/owners", match: new RegExp(`^/owners/${ID}$`), label: "owner detail" },
  { from: "/profitability", match: new RegExp(`^/profitability/${ID}$`), label: "profitability detail" },
  { from: "/forms", match: new RegExp(`^/forms/${ID}$`), label: "form builder" },
  { from: "/acquisition-insights", match: new RegExp(`^/acquisition-insights/${ID}$`), label: "evaluation" },
  { from: "/automations", match: new RegExp(`^/automations/rules/${ID}$`), label: "automation rule" },
  { from: "/inbox", match: new RegExp(`^/inbox/${ID}$`), label: "inbox thread" },
  { from: "/shares", match: new RegExp(`^/shares/${ID}$`), label: "share detail" },
  { from: "/tenants", match: new RegExp(`^/tenants/${ID}/reminders$`), label: "tenant reminders" },
  { from: "/contracts/templates", match: new RegExp(`^/contracts/templates/${ID}$`), label: "contract template" },
  { from: "/helpdesk", match: new RegExp(`^/helpdesk/${ID}$`), label: "support ticket" },
];

// ---------------------------------------------------------------------------
// In-page probe
// ---------------------------------------------------------------------------

/**
 * Runs inside the browser. Returns plain data only — nothing here can reference
 * anything from the Node scope.
 */
function probe(minTap) {
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = (el.getAttribute("class") || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .join(".");
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${id}${cls ? "." + cls : ""}${text ? ` "${text}"` : ""}`;
  };

  const viewport = window.innerWidth;

  /*
   * Measure the app's scroll container, not the document.
   *
   * `AppShellClient` puts `overflow-hidden` on its root and makes `<main>` the
   * scroller, so a table twice the width of the screen never widens
   * `document.documentElement` — it is clipped or it scrolls inside `main`.
   * Checking the document reported a clean pass for all 47 routes, which is
   * exactly what a broken instrument looks like. `main` is where the sideways
   * scroll actually lands; pages outside the shell fall back to the document.
   */
  const container = document.querySelector("main") ?? document.documentElement;
  const box = container.getBoundingClientRect();
  const limit = container === document.documentElement ? viewport : box.right;
  const docWidth = container.scrollWidth;
  const overflowBy = container.scrollWidth - container.clientWidth;

  /*
   * Innermost offenders only, and nothing inside a deliberate scroller.
   *
   * An element whose own child already spills is just reporting that width
   * upward, and a `<div class="overflow-x-auto"><table>…` is a choice rather
   * than a defect — the table scrolls in its own box and the page does not.
   */
  const inOwnScroller = (el) => {
    for (let p = el.parentElement; p && p !== container; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      // `hidden` counts too: a `truncate`d line still reports its full layout
      // width from getBoundingClientRect even though it is clipped and cannot
      // widen the page. Without this the ellipsis in every long label reads as
      // an overflow bug.
      if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
    }
    return false;
  };

  const offenders = [];
  if (overflowBy > 1) {
    for (const el of container.querySelectorAll("*")) {
      // An icon's `<path>` is never the thing to fix — report the `<svg>` or
      // whatever pushed it out, not its geometry.
      if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.right <= limit + 1) continue;
      if (inOwnScroller(el)) continue;
      // An `<svg>` is atomic here: its `<path>` children are skipped above, so
      // asking whether they spill would discard the one element worth naming.
      const atomic = el.tagName.toLowerCase() === "svg";
      const childSpills =
        !atomic &&
        Array.from(el.children).some(
          (child) => child.getBoundingClientRect().right > limit + 1
        );
      if (childSpills) continue;
      offenders.push({
        el: describe(el),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
      });
      if (offenders.length >= 8) break;
    }
  }

  // Tap targets. Only things actually on screen and actually interactive —
  // a hidden menu's buttons are not a mobile problem.
  //
  // Inline links are exempt, matching WCAG 2.5.8: a link inside a sentence
  // takes its size from the text around it, and padding it to 44px would wreck
  // the paragraph. Without this the count is dominated by footer and prose
  // links and tells you nothing about the controls that are genuinely hard to
  // hit.
  const small = [];
  const selector =
    'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="checkbox"], [role="switch"]';
  for (const el of document.querySelectorAll(selector)) {
    // A control inside (or labelled by) a `<label>` is activated by clicking
    // anywhere on that label, so the label is the real target. Measuring the
    // bare `<input>` reported every 20px checkbox as undersized even when it
    // sat in a comfortably tappable row.
    let target = el;
    if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") {
      const wrapping = el.closest("label");
      const associated = el.id
        ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
        : null;
      const label = wrapping || associated;
      if (label) {
        const lr = label.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        // Only when the label actually surrounds or adjoins the control.
        if (lr.width >= er.width && lr.height >= er.height) target = label;
      }
    }
    // `sr-only` inputs are deliberately collapsed to 1x1 and driven by a
    // visible label or button beside them — a file picker, usually. Their own
    // box says nothing about how tappable the control is.
    if (el.classList.contains("sr-only")) continue;
    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") continue;
    if (el.disabled) continue;
    // Off-screen below the fold still counts; off-screen sideways does not
    // (that is the overflow check's job, and would double-report).
    if (rect.right < 0 || rect.left > viewport) continue;
    if (el.tagName === "A" && style.display === "inline") continue;
    // Half a pixel of sub-pixel layout is not a usability defect: a
    // `min-h-11` control can measure 43.99px and would otherwise fail.
    if (rect.width < minTap - 0.5 || rect.height < minTap - 0.5) {
      small.push({
        el: describe(el),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      });
    }
  }

  return {
    viewport,
    docWidth,
    overflowBy,
    offenders,
    smallCount: small.length,
    small: small.slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const strict = argv.includes("--strict");
const wantShots = argv.includes("--shots");
const widthIndex = argv.indexOf("--width");
const widthArg = widthIndex === -1 ? null : argv[widthIndex + 1];
const explicitRoutes = argv
  .filter((a, i) => !a.startsWith("--") && i !== widthIndex + 1)
  .map((a) => (a.startsWith("/") ? a : `/${a}`));

const widths = widthArg ? WIDTHS.filter((w) => w.name === widthArg) : WIDTHS;
if (widths.length === 0) {
  console.error(`Unknown --width ${widthArg}. Known: ${WIDTHS.map((w) => w.name).join(", ")}`);
  process.exit(2);
}

const { browser, context, page } = await openSession();
const OUT = path.join(ARTIFACTS, "mobile");
if (wantShots) fs.mkdirSync(OUT, { recursive: true });

/**
 * Navigate, tolerating a dev server.
 *
 * `networkidle` is the wrong wait here: this app opens a cron scheduler and
 * polls in the background, so "no requests for 500ms" often never happens and
 * the goto times out — and a timed-out navigation then interrupts the next
 * one, so a single slow page took the four routes after it down with it. Wait
 * for the document instead and give the client components a fixed moment to
 * lay out.
 */
async function visit(pathname, { settle = 400 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await page.goto(url(pathname), {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => {});
      // Bounded `networkidle`, not a bare timeout.
      //
      // A fixed wait measures whatever happened to be painted when it elapsed:
      // /owners reported 174px of overflow on a warm route and a clean pass on
      // a cold one, purely because its table had not fetched yet. Waiting for
      // the network to settle catches the data; the cap keeps the background
      // pollers from hanging the run forever, which is why `networkidle` alone
      // could not be used here.
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
      await page.waitForTimeout(settle);
      return res;
    } catch (err) {
      lastError = err;
      await page.waitForTimeout(500);
    }
  }
  throw lastError;
}

/** Resolve the `[id]` routes by following a real link on the list page. */
async function discoverRoutes() {
  const found = [];
  for (const spec of DISCOVERED_ROUTES) {
    try {
      await visit(spec.from, { settle: 300 });
      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
      const hit = hrefs.find((h) => h && spec.match.test(h.split("?")[0]));
      if (hit) {
        found.push((hit.split("?")[0] + (spec.suffix ?? "")));
      } else {
        console.log(`  (no ${spec.label} to sample from ${spec.from} — skipped)`);
      }
    } catch (err) {
      console.log(`  (could not reach ${spec.from}: ${err.message} — skipped)`);
    }
  }
  return [...new Set(found)];
}

/**
 * Check the session before doing anything expensive.
 *
 * Discovery alone visits a dozen routes, each of which a cold dev server
 * compiles from scratch. Finding out only then that every one of them bounced
 * to /login wastes minutes and buries the reason under a wall of output.
 */
async function assertSignedIn() {
  try {
    await visit("/dashboard", { settle: 200 });
  } catch (err) {
    console.error(`\n  Could not reach /dashboard: ${err.message}`);
    console.error("  Is the dev server running on " + BASE_URL + "?\n");
    await browser.close();
    process.exit(2);
  }
  if (new URL(page.url()).pathname.startsWith("/login")) {
    // Recover rather than abort: three full sweeps have already been lost to
    // a session that lapsed part-way through.
    if (await autoLogin(context, page)) {
      console.log("  Session had lapsed — signed back in automatically.\n");
      await visit("/dashboard", { settle: 200 });
    } else {
      console.error(
        "\n  The saved session has expired — /dashboard redirected to /login.\n" +
          "  Run `node e2e/login.mjs`, sign in, then run this again.\n" +
          "  (Or set E2E_EMAIL / E2E_PASSWORD in .env.local to sign in automatically.)\n"
      );
      await browser.close();
      process.exit(2);
    }
  }
  await persistSession(context);
}

/**
 * Confirm the stylesheet is actually being generated before trusting a single
 * measurement.
 *
 * A dev server left running across hundreds of edits served stale Tailwind
 * output: `h-11` generated no CSS, so every element on the page measured at
 * roughly 58% of its declared size and the audit reported a page full of
 * undersized targets that were fine. Worse, it reproduced perfectly across
 * runs, so it looked like a real regression rather than a broken toolchain.
 */
async function assertStylesheetIsLive() {
  const sizes = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "h-11 w-11";
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const out = { h: cs.height, w: cs.width };
    probe.remove();
    return out;
  });
  if (sizes.h !== "44px" || sizes.w !== "44px") {
    console.error(
      `\n  Tailwind is not generating utilities (h-11 computed ${sizes.h} x ${sizes.w}, expected 44px).\n` +
        "  Every measurement from this run would be wrong. Restart the dev server\n" +
        "  (and clear .next/cache/webpack) before trusting the audit.\n"
    );
    await browser.close();
    process.exit(3);
  }
}

await assertSignedIn();
await assertStylesheetIsLive();

const routes = explicitRoutes.length
  ? explicitRoutes
  : [...STATIC_ROUTES, ...(await discoverRoutes()), ...fixtureRoutes()];

console.log(
  `\nAuditing ${routes.length} routes at ${widths.map((w) => w.width + "px").join(", ")}` +
    `${strict ? " (strict)" : ""}\n`
);

const report = [];
let overflowFails = 0;
let tapWarnings = 0;

for (const size of widths) {
  await page.setViewportSize({ width: size.width, height: size.height });
  console.log(`── ${size.width}×${size.height} ${"─".repeat(46)}`);

  for (const route of routes) {
    let entry = { route, width: size.width };
    try {
      const res = await visit(route);
      const landed = new URL(page.url()).pathname;
      // One clear message beats forty identical SKIP lines: if the session has
      // lapsed, every remaining route will bounce the same way.
      if (landed.startsWith("/login") && !route.startsWith("/login")) {
        if (await autoLogin(context, page)) {
          console.log(`  (session lapsed at ${route} — signed back in, continuing)`);
          await visit(route);
        } else {
          console.error(
            `\n  ${route} bounced to /login — the saved session has expired.\n` +
              "  Run `node e2e/login.mjs` and sign in, then run this again.\n"
          );
          await browser.close();
          process.exit(2);
        }
      }

      // A page that redirects client-side on mount tears the execution context
      // out from under the probe. Settle and measure again rather than
      // reporting it as an error — the page we want is the one it landed on.
      const measure = () =>
        page.evaluate(probe, MIN_TAP).catch(async () => {
          await page.waitForTimeout(1_000);
          return page.evaluate(probe, MIN_TAP);
        });

      // Re-measure until two consecutive readings agree.
      //
      // A reading taken on a freshly compiled route catches charts and
      // accordions mid-animation, with controls measured at a fraction of
      // their settled size: /profitability reported 18 undersized targets
      // against a true 10, /finances/tenant-charges 10 against a true 0. A
      // fixed second reading was not enough after a cold compile, so settle on
      // agreement instead and fall back to the last reading after 3 tries.
      let result = await measure();
      for (let attempt = 0; attempt < 2; attempt++) {
        await page.waitForTimeout(600);
        const again = await measure();
        if (again.smallCount === result.smallCount && again.overflowBy === result.overflowBy) {
          result = again;
          break;
        }
        result = again;
      }
      entry = { ...entry, status: res?.status() ?? 0, landed, ...result };

      const overflowed = result.overflowBy > 1;
      if (overflowed) overflowFails++;
      tapWarnings += result.smallCount;

      const mark = overflowed ? "FAIL" : result.smallCount > 0 ? "WARN" : "PASS";
      const bits = [];
      if (overflowed) bits.push(`overflows by ${result.overflowBy}px`);
      if (result.smallCount) bits.push(`${result.smallCount} target(s) < ${MIN_TAP}px`);
      console.log(`  [${mark}] ${route}${bits.length ? ` — ${bits.join(", ")}` : ""}`);
      for (const o of result.offenders) {
        console.log(`           ↳ ${o.el}  (right ${o.right}px, width ${o.width}px)`);
      }

      if (wantShots) {
        const file = path.join(
          OUT,
          `${size.width}${route.replace(/\//g, "_") || "_root"}.png`
        );
        await page.screenshot({ path: file, fullPage: true });
      }
    } catch (err) {
      entry.error = err.message;
      console.log(`  [ERR ] ${route} — ${err.message}`);
    }
    report.push(entry);
  }
  console.log("");
}

fs.mkdirSync(ARTIFACTS, { recursive: true });
const reportPath = path.join(ARTIFACTS, "mobile-audit.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

const checked = report.filter((r) => !r.error).length;
console.log("─".repeat(60));
console.log(`Checked ${checked} route/width pairs`);
console.log(`Horizontal overflow:  ${overflowFails}  ${overflowFails ? "← fix these" : "✓"}`);
console.log(`Tap targets < ${MIN_TAP}px:  ${tapWarnings}${strict ? "  ← counted as failures" : "  (warning)"}`);
console.log(`Report: ${reportPath}`);
if (wantShots) console.log(`Screens: ${OUT}`);

// Keeps the saved session alive for the next run (see persistSession).
await persistSession(context);
await browser.close();
process.exit(overflowFails > 0 || (strict && tapWarnings > 0) ? 1 : 0);

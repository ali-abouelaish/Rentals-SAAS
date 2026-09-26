// Mobile audit for the surfaces the route sweep cannot see: dialogs, drawers
// and modals.
//
//   node e2e/mobile-dialog-audit.mjs                 # every route, 360px
//   node e2e/mobile-dialog-audit.mjs properties      # just these routes
//   node e2e/mobile-dialog-audit.mjs --width 390
//   node e2e/mobile-dialog-audit.mjs --shots
//
// `mobile-audit.mjs` only ever measures a page with its dialogs closed, so a
// green sweep says nothing about the create/edit/add surfaces — which is most
// of what a property manager actually does. There are ~100 of them in the app
// (71 DialogContent, 10 SheetContent, 21 hand-rolled), and opening one by hand
// found real defects the sweep could not: no `role="dialog"`, a height cap on
// the wrong element, a submit button reachable only by luck.
//
// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------
// This script CLICKS things in a real tenant, so it is deliberately timid:
//
//   * only buttons whose label matches OPENERS are clicked,
//   * anything matching DESTRUCTIVE is skipped even if it also matches an
//     opener ("Edit and delete", say),
//   * nothing inside an opened dialog is ever clicked — it is measured and
//     dismissed with Escape,
//   * the tenant is verified by identity before anything is clicked.
//
// The worst case is therefore an opened-and-closed dialog, or a confirm prompt
// that is dismissed rather than confirmed.

import fs from "node:fs";
import path from "node:path";
import {
  openSession,
  url,
  ARTIFACTS,
  E2E_ROOT,
  persistSession,
  autoLogin,
  assertWritableTenant,
} from "./lib/harness.mjs";

const MIN_TAP = 44;

const OPENERS =
  /^(new|add|create|edit|invite|upload|raise|record|assign|link|import|protect|configure|set ?up|change|manage|customise|customize|choose|select|pick|filter|details|view|open|settings|schedule|log|register|enter|attach|connect)\b/i;

const DESTRUCTIVE =
  /(delete|remove|archive|deactivate|disable|revoke|destroy|lost|void|terminate|end tenancy|give notice|close ?out|send|email|sms|publish|export|download|sign|approve|reject|confirm|convert|pay|charge|refund|submit|save|update|apply|run|drain|sync|refresh|generate|issue|protect now)/i;

// Routes worth opening dialogs on — the create/edit-heavy ones.
const ROUTES = [
  "/properties",
  "/properties/new",
  "/owners",
  "/tenants",
  "/bookings",
  "/contracts",
  "/contracts/templates",
  "/rent-collection",
  "/finances",
  "/finances/overheads",
  "/finances/tenant-charges",
  "/profitability",
  "/acquisition-insights",
  "/shares",
  "/maintenance",
  "/keys",
  "/compliance",
  "/reminders",
  "/automations",
  "/automations/templates",
  "/forms",
  "/settings/booking-forms",
  "/settings/team",
  "/settings/bank-details",
  "/settings/api-keys",
  "/settings/email",
  "/settings/integrations",
];

// ---------------------------------------------------------------------------
// In-page probes
// ---------------------------------------------------------------------------

/** Every candidate opener on the page, as stable indices into a fresh query. */
function collectOpeners({ open, bad }) {
  const OPEN = new RegExp(open, "i");
  const BAD = new RegExp(bad, "i");
  const out = [];
  const nodes = [...document.querySelectorAll("button, [role='button']")];
  nodes.forEach((el, i) => {
    // Visible text first. Preferring `title` matched the tooltip instead of the
    // button — "New Work Order" was being read as "Create a work order
    // directly — no tenant ticket needed", which then blew a length cap.
    const text = (el.textContent || "").trim().replace(/\s+/g, " ");
    const label = text || el.getAttribute("aria-label") || el.title || "";
    if (!label || label.length > 60) return;
    // Tabs and filter pills are not dialog openers; clicking them only churns
    // the page and produces noise.
    if (el.getAttribute("role") === "tab" || el.closest('[role="tablist"]')) return;
    if (BAD.test(label)) return;
    if (!OPEN.test(label)) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (el.disabled) return;
    out.push({ index: i, label });
  });
  return out;
}

/** Measure whatever modal surface is currently open. */
function measureDialog(minTap) {
  const panel =
    document.querySelector('[role="dialog"]') ||
    document.querySelector("[data-radix-dialog-content]") ||
    // Hand-rolled modals: a fixed full-screen overlay whose inner panel is the
    // thing to measure.
    (() => {
      const overlay = [...document.querySelectorAll("div.fixed.inset-0")].find((d) => {
        const cs = getComputedStyle(d);
        return cs.position === "fixed" && d.getBoundingClientRect().width > 0 && Number(cs.zIndex) >= 40;
      });
      return overlay?.querySelector(":scope > div:not([class*='absolute'])") ?? overlay ?? null;
    })();
  if (!panel) return null;

  const rect = panel.getBoundingClientRect();
  const vh = window.innerHeight;
  const vw = window.innerWidth;

  const describe = (el) => {
    const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${text ? ` "${text}"` : ""}`;
  };

  // Does the panel fit, and does its content scroll rather than get cut off?
  const overflowsViewport = rect.bottom > vh + 1 || rect.top < -1 || rect.right > vw + 1 || rect.left < -1;
  const scroller = panel.querySelector("[class*='overflow-y-auto'], [class*='overflow-auto']");
  const bodyScrolls = Boolean(scroller) || getComputedStyle(panel).overflowY === "auto";

  // Is every control inside reachable and big enough?
  const small = [];
  let offscreen = 0;
  const sel =
    'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="checkbox"], [role="switch"]';
  for (const el of panel.querySelectorAll(sel)) {
    if (el.classList.contains("sr-only")) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (el.disabled) continue;
    let target = el;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) {
      const lbl = el.closest("label") || (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
      if (lbl) {
        const lr = lbl.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        if (lr.width >= er.width && lr.height >= er.height) target = lbl;
      }
    }
    const r = target.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // A control below the fold inside a scrollable body is fine; one below the
    // fold in a panel that cannot scroll is unreachable.
    if (r.bottom > vh + 1 && !bodyScrolls) offscreen++;
    if (r.width < minTap - 0.5 || r.height < minTap - 0.5) {
      small.push({ el: describe(target), w: Math.round(r.width), h: Math.round(r.height) });
    }
  }

  return {
    role: panel.getAttribute("role") || null,
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    viewportHeight: vh,
    overflowsViewport,
    bodyScrolls,
    offscreen,
    smallCount: small.length,
    small: small.slice(0, 6),
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const wantShots = argv.includes("--shots");
const widthIndex = argv.indexOf("--width");
const width = widthIndex === -1 ? 360 : Number(argv[widthIndex + 1]);
const widthValueIndex = widthIndex === -1 ? -1 : widthIndex + 1;
const explicit = argv
  .filter((a, i) => !a.startsWith("--") && i !== widthValueIndex)
  .map((a) => (a.startsWith("/") ? a : `/${a}`));

// Verified by identity, not by a brand string that two tenants share.
await assertWritableTenant();

const { browser, context, page } = await openSession();
const OUT = path.join(ARTIFACTS, "dialogs");
if (wantShots) fs.mkdirSync(OUT, { recursive: true });

await page.setViewportSize({ width, height: 740 });

async function visit(pathname) {
  for (let i = 0; i < 2; i++) {
    try {
      await page.goto(url(pathname), { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(500);
      return true;
    } catch {
      await page.waitForTimeout(500);
    }
  }
  return false;
}

const routes = explicit.length ? explicit : ROUTES;
console.log(`\nOpening dialogs across ${routes.length} routes at ${width}px\n`);

const findings = [];
let opened = 0;
let clean = 0;

for (const route of routes) {
  if (!(await visit(route))) {
    console.log(`  [SKIP] ${route} — could not load`);
    continue;
  }
  if (new URL(page.url()).pathname.startsWith("/login")) {
    if (!(await autoLogin(context, page))) {
      console.error("\n  Session expired and could not sign back in.\n");
      break;
    }
    await visit(route);
  }

  const candidates = await page
    .evaluate(collectOpeners, { open: OPENERS.source, bad: DESTRUCTIVE.source })
    .catch(() => []);
  if (!candidates.length) continue;
  console.log(`── ${route} — ${candidates.length} opener(s)`);

  for (const c of candidates) {
    try {
      // Re-query each time: opening and closing a dialog re-renders the page.
      const handle = page.locator("button, [role='button']").nth(c.index);
      if ((await handle.count()) === 0) continue;
      const labelNow = ((await handle.textContent().catch(() => "")) || "").trim().replace(/\s+/g, " ") || c.label;
      if (DESTRUCTIVE.test(labelNow)) continue;

      await handle.click({ timeout: 4_000 });
      await page.waitForTimeout(700);

      const m = await page.evaluate(measureDialog, MIN_TAP);
      if (m) {
        opened++;
        const problems = [];
        if (!m.role) problems.push("no role=dialog");
        if (m.overflowsViewport && !m.bodyScrolls) problems.push(`panel ${m.height}px > viewport ${m.viewportHeight}px and does not scroll`);
        if (m.offscreen) problems.push(`${m.offscreen} control(s) unreachable below the fold`);
        if (m.smallCount) problems.push(`${m.smallCount} target(s) < ${MIN_TAP}px`);

        if (problems.length) {
          console.log(`   [WARN] "${c.label}" — ${problems.join("; ")}`);
          m.small.forEach((s) => console.log(`            ${s.w}x${s.h}  ${s.el}`));
          findings.push({ route, opener: c.label, ...m, problems });
          if (wantShots) {
            const safe = `${route}__${c.label}`.replace(/[^a-z0-9]+/gi, "_").slice(0, 80);
            await page.screenshot({ path: path.join(OUT, `${width}_${safe}.png`) }).catch(() => {});
          }
        } else {
          clean++;
          console.log(`   [ok]   "${c.label}"`);
        }
      }

      // Never interact with the contents — just dismiss.
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(300);
      // Some hand-rolled modals ignore Escape; reload to guarantee a clean slate.
      if (await page.evaluate(() => Boolean(document.querySelector('[role="dialog"]')))) {
        await visit(route);
      }
    } catch {
      // An opener that navigates instead of opening a dialog is not a failure.
      if (new URL(page.url()).pathname !== route) await visit(route);
    }
  }
}

fs.mkdirSync(ARTIFACTS, { recursive: true });
const reportPath = path.join(ARTIFACTS, "mobile-dialog-audit.json");
fs.writeFileSync(reportPath, JSON.stringify(findings, null, 2));

console.log("\n" + "─".repeat(60));
console.log(`Dialogs opened:  ${opened}`);
console.log(`Clean:           ${clean}`);
console.log(`With problems:   ${findings.length}`);
console.log(`Report: ${reportPath}`);
if (wantShots) console.log(`Screens: ${OUT}`);

await persistSession(context);
await browser.close();
process.exit(findings.length ? 1 : 0);

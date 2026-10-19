// p01 — Route smoke (READ-ONLY).
//
// Open every PM route (and the public ones) at desktop width and assert each is
// actually usable: no bounce to /login, no 4xx/5xx, no error overlay or boundary,
// a heading present. attachErrorCapture logs every pageerror / console.error /
// 5xx / overlay seen along the way, tagged with the route, for the report.
//
// Id-addressed routes get their ids two ways: by following the first matching
// link on the relevant list page (survives reseeding), and from
// e2e/audit-fixtures.json for pages no list links to. Two routes are special:
// /forms/{id} must REDIRECT to /forms, and /marketing must show its placeholder.
//
//   node e2e/pm/p01-route-smoke.mjs
//   node e2e/pm/p01-route-smoke.mjs /properties /maintenance   # just these

import fs from "node:fs";
import path from "node:path";
import {
  openSignedIn,
  openAnonymous,
  url,
  check,
  skip,
  summary,
  attachErrorCapture,
  visit,
  scanPage,
  writeResults,
} from "./lib/pm.mjs";
import { E2E_ROOT } from "../lib/harness.mjs";

const FIXTURES = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(E2E_ROOT, "audit-fixtures.json"), "utf8"));
  } catch {
    return {};
  }
})();

// Every PM surface reachable at a fixed URL (mirrors the mobile-audit inventory).
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

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const DISCOVER = [
  { from: "/properties", match: new RegExp(`^/properties/${UUID}$`), label: "property detail" },
  { from: "/properties", match: new RegExp(`^/properties/${UUID}$`), suffix: "/edit", label: "property edit" },
  { from: "/properties", match: new RegExp(`^/properties/${UUID}$`), suffix: "/setup", label: "property setup" },
  { from: "/owners", match: new RegExp(`^/owners/${UUID}$`), label: "owner detail" },
  { from: "/profitability", match: new RegExp(`^/profitability/${UUID}$`), label: "profitability detail" },
  { from: "/acquisition-insights", match: new RegExp(`^/acquisition-insights/${UUID}$`), label: "evaluation" },
  { from: "/automations", match: new RegExp(`^/automations/rules/${UUID}$`), label: "automation rule" },
  { from: "/inbox", match: new RegExp(`^/inbox/${UUID}$`), label: "inbox thread" },
  { from: "/shares", match: new RegExp(`^/shares/${UUID}$`), label: "share detail" },
  { from: "/tenants", match: new RegExp(`^/tenants/${UUID}/reminders$`), label: "tenant reminders" },
  { from: "/contracts/templates", match: new RegExp(`^/contracts/templates/${UUID}$`), label: "contract template" },
  { from: "/compliance", match: new RegExp(`^/compliance/${UUID}$`), label: "certificate detail" },
  { from: "/helpdesk", match: new RegExp(`^/helpdesk/${UUID}$`), label: "support ticket" },
];

const argv = process.argv.slice(2).map((a) => (a.startsWith("/") ? a : `/${a}`));
const only = argv.length ? argv : null;

console.log("\np01 — Route smoke (read-only)\n");

const { browser, context, page } = await openSignedIn();
const cap = attachErrorCapture(page, "p01");

/** Follow the first link matching a discovery spec, to resolve a real id route. */
async function discover() {
  const found = [];
  for (const spec of DISCOVER) {
    try {
      cap.tag(`discover:${spec.label}`, spec.from);
      await visit(page, spec.from, cap, { settle: 300, expectHeading: false });
      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
      const hit = hrefs.find((h) => h && spec.match.test(h.split("?")[0]));
      if (hit) found.push({ route: hit.split("?")[0] + (spec.suffix ?? ""), label: spec.label });
      else console.log(`  (no ${spec.label} to sample from ${spec.from})`);
    } catch (err) {
      console.log(`  (could not reach ${spec.from}: ${err.message.split("\n")[0]})`);
    }
  }
  // Dedupe by route.
  const seen = new Set();
  return found.filter((f) => (seen.has(f.route) ? false : seen.add(f.route)));
}

try {
  // --- Static signed-in routes ---------------------------------------------
  let n = 0;
  for (const route of STATIC_ROUTES) {
    if (only && !only.includes(route)) continue;
    await check(`01.s${++n}`, `GET ${route}`, async () => {
      cap.tag(`01.s${n}`, route);
      return await visit(page, route, cap);
    });
  }

  // --- /marketing placeholder (special) ------------------------------------
  if (!only || only.includes("/marketing")) {
    await check("01.marketing", "/marketing shows its placeholder", async () => {
      cap.tag("01.marketing", "/marketing");
      const nav = await visit(page, "/marketing", cap);
      if (!nav.pass) return nav;
      const body = (await page.locator("body").innerText()).toLowerCase();
      return { pass: /coming soon/.test(body), detail: /coming soon/.test(body) ? "placeholder shown" : "no placeholder text" };
    });
  }

  // --- Discovered id routes -------------------------------------------------
  if (!only) {
    const idRoutes = await discover();
    console.log(`  (discovered ${idRoutes.length} id-routed pages)\n`);
    let m = 0;
    for (const { route, label } of idRoutes) {
      await check(`01.d${++m}`, `GET ${route} (${label})`, async () => {
        cap.tag(`01.d${m}`, route);
        return await visit(page, route, cap);
      });
    }

    // --- /forms/{id} must redirect to /forms -------------------------------
    // Sample a real form id from the fixtures (no list links to /forms/{id}).
    const formId = FIXTURES.formId;
    if (formId) {
      await check("01.forms-redirect", `/forms/${formId} redirects to /forms`, async () => {
        cap.tag("01.forms-redirect", `/forms/${formId}`);
        await page.goto(url(`/forms/${formId}`), { waitUntil: "networkidle" }).catch(() => {});
        const landed = new URL(page.url()).pathname;
        return { pass: landed === "/forms", detail: `landed ${landed}` };
      });
    } else {
      skip("01.forms-redirect", "/forms/{id} redirect", "no formId in audit-fixtures.json");
    }

    // --- Fixture-only id routes (responses page etc.) ----------------------
    const fixtureRoutes = [];
    if (FIXTURES.formId) fixtureRoutes.push(`/forms/${FIXTURES.formId}/responses`);
    let f = 0;
    for (const route of fixtureRoutes) {
      await check(`01.f${++f}`, `GET ${route} (fixture)`, async () => {
        cap.tag(`01.f${f}`, route);
        return await visit(page, route, cap);
      });
    }
  }

  // --- Public routes (anonymous context) -----------------------------------
  if (!only) {
    const publicRoutes = [
      // The portal resolves its tenant from the subdomain; on localhost there is
      // none, so the company slug must be passed explicitly or it 404s by design.
      ["/portal/login?companySlug=test", "portal login"],
      FIXTURES.formPublicSlug ? [`/f/${FIXTURES.formPublicSlug}`, "public form"] : null,
      FIXTURES.shareToken ? [`/s/${FIXTURES.shareToken}`, "public share"] : null,
    ].filter(Boolean);

    const { browser: anon, page: anonPage } = await openAnonymous();
    const anonCap = attachErrorCapture(anonPage, "p01");
    try {
      let p = 0;
      for (const [route, label] of publicRoutes) {
        await check(`01.p${++p}`, `GET ${route} (${label}, anon)`, async () => {
          anonCap.tag(`01.p${p}`, route);
          // Public pages live outside the app shell; a heading is not guaranteed.
          return await visit(anonPage, route, anonCap, { expectHeading: false });
        });
      }
      // Fold anonymous captures into the main handle so the report has them all.
      cap.captured.push(...anonCap.captured);
    } finally {
      await anon.close();
    }
  }
} finally {
  const result = summary("p01");
  writeResults("p01", result, cap);
  await browser.close();
  process.exit(result.fail > 0 ? 1 : 0);
}

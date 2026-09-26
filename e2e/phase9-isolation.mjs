// Phase 9 — Tenant-isolation probes (plan steps 27-28).
//
// The most important phase in the plan. RLS is the only tenant boundary in this
// app, so "a signed-in user of tenant A cannot reach tenant B's rows" is the one
// invariant that, if broken, is a data breach rather than a bug. It has never
// been verified end to end.
//
// What counts as a pass: the page must deny — 404, a redirect away, or an empty
// state. What counts as a FAIL: any foreign record actually rendering. The
// probes therefore assert on rendered content, not only on status codes, since
// a 200 that renders an empty shell is fine and a 200 that renders the foreign
// address is not.
//
//   node e2e/phase9-isolation.mjs

import { openSession, openAnonymous, url, check, skip, summary, shot } from "./lib/harness.mjs";

// Foreign-tenant fixtures, from the round-2 plan.
const FOREIGN = {
  property: "bb100000-0000-4000-8000-000000000003",
  unit: "bb300002-0000-4000-8000-000000000001",
  contract: "e1ff404d-49f5-4bbb-bac0-19a029f3b7bf",
};
const FORM_SLUG = "d101d8e1e96f";

// Strings that would only appear if a foreign row actually rendered. Kept
// deliberately generic: we do not know the other tenant's data, so we look for
// the shape of a populated detail page instead of specific values, and print
// what we saw for a human to judge.
const POPULATED_MARKERS = [
  /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/, // a UK postcode
  /rent\s*£\s*[\d,]+/i,
  /tenancy start/i,
];

const { browser, page } = await openSession();

async function probe(pathname) {
  const res = await page.goto(url(pathname), { waitUntil: "networkidle" });
  const status = res?.status() ?? 0;
  const landed = new URL(page.url()).pathname;
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  return { status, landed, body };
}

// A page that crashes also fails to show foreign data, so "nothing leaked" is
// not by itself a pass worth trusting. Grade the *quality* of the denial too:
// a clean 404 is correct, an error boundary is a bug that happens to be safe,
// and a framework internal reaching the user is a bug that also leaks
// implementation detail. All three are non-leaks; only the first is right.
const CRASH_MARKERS = [
  /something went wrong/i,
  /NEXT_NOT_FOUND/,
  /NEXT_REDIRECT/,
  /application error/i,
  /unhandled/i,
  /digest:/i,
];

/**
 * Deny = 404 / not-found copy / redirected away / nothing populated rendered.
 * Returns pass for any non-leak, but flags a messy denial in the detail.
 */
function verdict(pathname, { status, landed, body }) {
  const redirected = landed !== pathname;
  const notFound =
    status === 404 || /not found|doesn't exist|no longer available|404/i.test(body);
  const populated = POPULATED_MARKERS.some((re) => re.test(body));
  const crashed = CRASH_MARKERS.find((re) => re.test(body));

  if (populated && !notFound) {
    return { pass: false, detail: `LEAK: rendered foreign data (HTTP ${status}, at ${landed})` };
  }
  if (crashed) {
    return {
      pass: true,
      detail: `no leak, but denied by CRASH not 404 — matched ${crashed} (HTTP ${status}). Logged as a finding.`,
      messy: true,
    };
  }
  return {
    pass: true,
    detail: `clean deny (HTTP ${status}${redirected ? `, redirected to ${landed}` : ""}${
      notFound ? ", not-found copy" : ""
    })`,
  };
}

console.log("\nPhase 9 — Tenant isolation\n");
console.log("Signed in as the test tenant; every URL below belongs to another tenant.\n");

const targets = [
  ["27a", "foreign property detail", `/properties/${FOREIGN.property}`],
  ["27b", "foreign property EDIT", `/properties/${FOREIGN.property}/edit`],
  ["27c", "foreign property setup", `/properties/${FOREIGN.property}/setup`],
  ["27d", "foreign property profitability", `/profitability/${FOREIGN.property}`],
  ["27e", "foreign contract via tenants route", `/tenants/${FOREIGN.contract}/reminders`],
];

for (const [id, title, pathname] of targets) {
  await check(id, `${title} must deny — ${pathname}`, async () => {
    const seen = await probe(pathname);
    const v = verdict(pathname, seen);
    if (!v.pass) await shot(page, `LEAK-${id}`);
    return v;
  });
}

// Step 28 — public apply URL with a mismatched form/unit combination. Runs
// signed OUT, because /apply is a public route and that is how an attacker
// would hit it.
await check("28", "public /apply with foreign unit id must be rejected", async () => {
  const { browser: anon, page: anonPage } = await openAnonymous();
  try {
    const target = url(`/apply/${FORM_SLUG}?unit=${FOREIGN.unit}`);
    const res = await anonPage.goto(target, { waitUntil: "networkidle" });
    const status = res?.status() ?? 0;
    const body = (await anonPage.locator("body").innerText()).replace(/\s+/g, " ");
    const populated = POPULATED_MARKERS.some((re) => re.test(body));
    const rejected = status === 404 || /not found|invalid|unavailable/i.test(body);

    if (populated && !rejected) {
      await anonPage.screenshot({ path: "e2e/artifacts/LEAK-28.png", fullPage: true });
      return { pass: false, detail: `LEAK: foreign unit rendered publicly (HTTP ${status})` };
    }
    return { pass: true, detail: `rejected/ignored (HTTP ${status})` };
  } finally {
    await anon.close();
  }
});

skip("29", "agent-role (non-admin) permission probe", "needs a second user invite — Ali's call");

const result = summary("Phase 9");
await browser.close();
process.exit(result.fail > 0 ? 1 : 0);

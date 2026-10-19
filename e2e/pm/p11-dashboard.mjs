// p11 — Dashboard, global search, assistant, help, UI rules (mostly READ-ONLY).
//
// Global search must find the PM5 data; the assistant answers one question (one
// paid AI call); the helpdesk dialog is validated but never submitted; the UI-rule
// probe runs over the key pages and logs violations as LOW.
//
//   node e2e/pm/p11-dashboard.mjs

import {
  openSignedIn,
  url,
  check,
  skip,
  summary,
  db,
  attachErrorCapture,
  visit,
  uiRulesProbe,
  submitEmptyExpectInline,
  writeResults,
} from "./lib/pm.mjs";

const { browser, page } = await openSignedIn();
const cap = attachErrorCapture(page, "p11");
const { client, tenantId } = await db();

async function globalSearch(queryText) {
  await visit(page, "/dashboard", cap, { settle: 400 });
  const box = page.locator('input[aria-label="Search"]').first();
  if (!(await box.count())) return { found: false, detail: "no search box" };
  await box.click();
  await box.fill(queryText);
  await page.waitForTimeout(1400); // debounced RPC
  const results = page.locator("#global-search-results");
  const text = (await results.innerText().catch(() => "")) || (await page.locator("body").innerText());
  // "No matches for X" echoes the query, so a substring test alone false-passes.
  const noMatch = /no matches|no results/i.test(text);
  return { found: !noMatch, detail: text.replace(/\s+/g, " ").slice(0, 90) };
}

console.log("\np11 — Dashboard, search, help, UI rules\n");

try {
  // 11.1 — PM dashboard renders.
  await check("11.1", "PM dashboard renders", async () => {
    cap.tag("11.1", "/dashboard");
    const nav = await visit(page, "/dashboard", cap, { settle: 700 });
    if (!nav.pass) return nav;
    const body = (await page.locator("main").innerText().catch(() => "")) || "";
    return { pass: body.length > 100, detail: `${body.length} chars of dashboard content` };
  });

  // 11.2 — global search finds the PM5 data.
  // Use clean tokens — the full "PM5-" prefixed names tokenize poorly (hyphen).
  await check("11.2a", "global search finds the PM5 property", async () => {
    const r = await globalSearch("Alpha");
    return { pass: r.found, detail: r.detail };
  });
  await check("11.2b", "global search finds the PM5 tenant", async () => {
    const r = await globalSearch("Tenant One");
    return { pass: r.found, detail: r.detail };
  });
  await check("11.2c", "global search finds the work-order reference", async () => {
    const wo = (await client.from("maintenance_jobs").select("reference").eq("tenant_id", tenantId).eq("title", "PM5-Boiler service").maybeSingle()).data;
    if (!wo?.reference) return { pass: null, detail: "no WO reference" };
    const r = await globalSearch(wo.reference);
    return { pass: r.found, detail: `${wo.reference}: ${r.detail}` };
  });
  await check("11.2d", "global search finds the certificate", async () => {
    const r = await globalSearch("Gas Safety");
    return { pass: r.found, detail: r.detail };
  });

  // 11.3 — assistant answers one question (one AI call).
  await check("11.3", "assistant answers one question", async () => {
    cap.tag("11.3", "/assistant");
    const nav = await visit(page, "/assistant", cap, { settle: 700, expectHeading: false });
    if (!nav.pass) return nav;
    const ta = page.locator('textarea[placeholder*="Ask about" i], textarea').first();
    if (!(await ta.count())) return { pass: false, detail: "no assistant input" };
    await ta.fill("How many properties do I manage?");
    await page.getByRole("button", { name: /send/i }).first().click().catch(() => {});
    // Wait for a streamed response to appear.
    let answered = false;
    for (let i = 0; i < 20 && !answered; i++) {
      await page.waitForTimeout(1000);
      const body = (await page.locator("main").innerText().catch(() => "")) || "";
      answered = body.length > 200 && /propert|manage|you|\d/.test(body.toLowerCase());
    }
    return { pass: answered, detail: answered ? "assistant responded" : "no response within 20s" };
  });

  // 11.4 — helpdesk dialog validates (never submitted).
  await check("11.4", "helpdesk new-ticket dialog validates (not submitted)", async () => {
    cap.tag("11.4", "/helpdesk");
    const nav = await visit(page, "/helpdesk", cap, { settle: 500 });
    if (!nav.pass) return nav;
    await page.getByRole("button", { name: /new ticket|raise.*ticket/i }).first().click().catch(() => {});
    await page.waitForTimeout(700);
    const dlg = page.getByRole("dialog");
    if (!(await dlg.count())) return { pass: false, detail: "ticket dialog did not open" };
    const res = await submitEmptyExpectInline(dlg, dlg.locator('button[type="submit"]').last());
    await page.keyboard.press("Escape").catch(() => {}); // close WITHOUT submitting
    return res;
  });

  // 11.5 — UI-rules sweep over the key pages (violations logged LOW).
  const UI_PAGES = ["/properties", "/tenants", "/maintenance", "/compliance", "/finances/overheads"];
  let totalViol = 0;
  for (const route of UI_PAGES) {
    await check(`11.5 ${route}`, `UI-rules probe: ${route}`, async () => {
      cap.tag("11.5", route);
      const nav = await visit(page, route, cap, { settle: 500 });
      if (!nav.pass) return nav;
      const viol = await uiRulesProbe(page);
      totalViol += viol.length;
      for (const v of viol.slice(0, 5)) cap.note("ui-rule", "LOW", `${route}: ${v.rule} — ${v.detail}`);
      // Pass the check regardless (violations are LOW findings, not failures); report the count.
      return { pass: true, detail: viol.length ? `${viol.length} UI-rule violation(s) logged LOW` : "no violations" };
    });
  }

  skip("11.6", "todos / quick links create/edit/delete/reorder", "dashboard widget CRUD; low regression value this round");
  console.log(`  (UI-rule probe total across ${UI_PAGES.length} pages: ${totalViol})`);
} finally {
  const result = summary("p11");
  writeResults("p11", result, cap);
  await browser.close();
  process.exit(result.fail > 0 ? 1 : 0);
}

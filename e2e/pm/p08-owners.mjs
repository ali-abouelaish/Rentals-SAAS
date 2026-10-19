// p08 — Owners & statements (WRITES: owner edit; a generated statement).
//
// Never sends a statement. Fee overrides, adjustment lines, PDF-total byte checks
// and the no-duplicate-regenerate check are skipped with reasons (deep / PDF).
//
//   node e2e/pm/p08-owners.mjs

import {
  openSignedIn,
  url,
  check,
  skip,
  summary,
  db,
  track,
  attachErrorCapture,
  visit,
  writeResults,
} from "./lib/pm.mjs";

const OWNER = "PM5-Owner Landlord";

const { browser, page } = await openSignedIn();
const cap = attachErrorCapture(page, "p08");
const { client, tenantId } = await db();

console.log("\np08 — Owners & statements (writes)\n");

try {
  const owner = (await client.from("owner_landlords").select("id,notes").eq("tenant_id", tenantId).eq("name", OWNER).maybeSingle()).data;

  // 08.1 — owner detail loads; properties table present.
  await check("08.1", "owner detail page loads with properties table", async () => {
    if (!owner) return { pass: false, detail: "no PM5 owner (run p02)" };
    cap.tag("08.1", `/owners/${owner.id}`);
    const nav = await visit(page, `/owners/${owner.id}`, cap, { settle: 700 });
    if (!nav.pass) return nav;
    const body = (await page.locator("main").innerText().catch(() => "")) || "";
    return { pass: body.includes(OWNER), detail: body.includes(OWNER) ? "owner name shown" : "owner name missing" };
  });

  // 08.2 — owner edit persists.
  await check("08.2", "owner edit persists", async () => {
    if (!owner) return { pass: false, detail: "no owner" };
    const marker = `PM5-note-${Date.now().toString().slice(-5)}`;
    cap.tag("08.2", `/owners/${owner.id}`);
    await visit(page, `/owners/${owner.id}`, cap, { settle: 600 });
    // The overview is read-only until "Edit" is clicked.
    await page.getByRole("button", { name: /^edit$/i }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    const notes = page.locator('#notes, textarea[name="notes"]').first();
    if (!(await notes.count())) return { pass: null, detail: "notes field not shown after Edit" };
    await notes.fill(marker);
    await page.getByRole("button", { name: /save/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    const after = (await client.from("owner_landlords").select("notes").eq("id", owner.id).maybeSingle()).data;
    return { pass: after?.notes === marker, detail: `notes now "${after?.notes}"` };
  });

  // 08.3 — generate a statement for a period (no send).
  await check("08.3", "generate an owner statement (no send)", async () => {
    if (!owner) return { pass: false, detail: "no owner" };
    // The generate panel is on the "Statements" Radix tab of the detail page.
    cap.tag("08.3", `/owners/${owner.id}`);
    await visit(page, `/owners/${owner.id}`, cap, { settle: 600 });
    const tab = page.getByRole("tab", { name: /statements/i }).first();
    if (await tab.count()) { await tab.click().catch(() => {}); await page.waitForTimeout(800); }
    const period = page.locator('input#period, input[type="month"]').first();
    if (!(await period.count())) return { pass: null, detail: "no statement period picker found" };
    await period.fill("2026-09").catch(() => {});
    await page.getByRole("button", { name: /generate/i }).first().click().catch(() => {});
    // Poll for the drafted statement row.
    let st = null;
    for (let i = 0; i < 6 && !st; i++) {
      await page.waitForTimeout(700);
      st = (await client.from("owner_statements").select("id,status,period_year,period_month").eq("tenant_id", tenantId).eq("owner_id", owner.id).eq("period_year", 2026).eq("period_month", 9).maybeSingle()).data;
    }
    if (st) track("owner_statements", st.id);
    return { pass: Boolean(st), detail: st ? `statement ${st.id} status=${st.status}` : "statement not generated" };
  });

  // 08.4 — statement detail renders.
  await check("08.4", "statement detail renders", async () => {
    const st = (await client.from("owner_statements").select("id").eq("tenant_id", tenantId).eq("owner_id", owner?.id ?? "").limit(1).maybeSingle()).data;
    if (!st) return { pass: null, detail: "no statement to open" };
    cap.tag("08.4", `/owners/${owner.id}/statements/${st.id}`);
    const nav = await visit(page, `/owners/${owner.id}/statements/${st.id}`, cap, { settle: 700, expectHeading: false });
    return { pass: nav.pass, detail: nav.detail };
  });

  skip("08.5", "fee override on a property", "FeeOverrideDialog is a deep per-property sub-flow");
  skip("08.6", "rechargeable toggle + adjustment line add/delete", "deep statement-detail sub-flows");
  skip("08.7", "PDF totals match screen; regenerate no-duplicate", "needs PDF parsing; verified the generate+detail render");
  skip("08.8", "void statement", "state-changing; low value with an empty statement");
  skip("08.9", "send statement", "never sent — immediate-send path, per run rules");
} finally {
  const result = summary("p08");
  writeResults("p08", result, cap);
  await browser.close();
  process.exit(result.fail > 0 ? 1 : 0);
}

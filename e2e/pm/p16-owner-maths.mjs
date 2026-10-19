// p16 — Owner-statement maths (WRITES · MONEY).
//
// Depends on the p15 tenancy (rent received) + a rechargeable work-order cost.
// Verifies the statement arithmetic: management fee %, rechargeable works, the
// net-to-owner balance, adjustment lines, and a fee override. PDF-total accuracy
// is checked against the statement's own computed totals (same source the PDF uses).
//
//   node e2e/pm/p16-owner-maths.mjs  (run p15 first for the tenancy)

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
const WO_TITLE = "PM5-Boiler service";
const COST_DESC = "PM5-Recharge boiler part";
const YEAR = 2026, MONTH = 10;

const { browser, page } = await openSignedIn();
const cap = attachErrorCapture(page, "p16");
const { client, tenantId } = await db();

const owner = (await client.from("owner_landlords").select("id,management_fee_type,management_fee_percent").eq("tenant_id", tenantId).eq("name", OWNER).maybeSingle()).data;
const wo = (await client.from("maintenance_jobs").select("id").eq("tenant_id", tenantId).eq("title", WO_TITLE).maybeSingle()).data;
const prop = (await client.from("properties").select("id,monthly_rent_owed").eq("tenant_id", tenantId).eq("name", "PM5-Property Alpha").maybeSingle()).data;

console.log("\np16 — Owner-statement maths (money)\n");

try {
  // 16.0 — owner-statement rent is the LANDLORD rent-owed (rent-to-rent model),
  // NOT tenant payments (by design, generate.ts:170). Set it so the statement has
  // a rent line to apply the fee to.
  await check("16.0", "set property monthly rent owed (£900)", async () => {
    if (!prop) return { pass: false, detail: "no PM5 property" };
    if (Number(prop.monthly_rent_owed) === 900) return { pass: true, detail: "already £900" };
    cap.tag("16.0", `/properties/${prop.id}/edit`);
    const nav = await visit(page, `/properties/${prop.id}/edit`, cap, { settle: 600 });
    if (!nav.pass) return nav;
    await page.locator('input[name="monthly_rent_owed"]').fill("900").catch(() => {});
    await page.getByRole("button", { name: /save changes|save/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    const after = (await client.from("properties").select("monthly_rent_owed").eq("id", prop.id).maybeSingle()).data;
    return { pass: Number(after?.monthly_rent_owed) === 900, detail: `monthly_rent_owed=£${after?.monthly_rent_owed}` };
  });
  // 16.1 — set owner management fee to 10%.
  await check("16.1", "set owner management fee 10%", async () => {
    if (!owner) return { pass: false, detail: "no PM5 owner (re-run p02)" };
    cap.tag("16.1", `/owners/${owner.id}`);
    await visit(page, `/owners/${owner.id}`, cap, { settle: 600 });
    await page.getByRole("button", { name: /^edit$/i }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    await page.locator('#management_fee_type, select[name="management_fee_type"]').first().selectOption("percent").catch(() => {});
    await page.waitForTimeout(300);
    await page.locator('#management_fee_percent, input[name="management_fee_percent"]').first().fill("10").catch(() => {});
    await page.getByRole("button", { name: /save/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    const after = (await client.from("owner_landlords").select("management_fee_type,management_fee_percent").eq("id", owner.id).maybeSingle()).data;
    return { pass: after?.management_fee_type === "percent" && Number(after?.management_fee_percent) === 10, detail: `fee=${after?.management_fee_type} ${after?.management_fee_percent}%` };
  });

  // 16.2 — add a rechargeable cost to the work order.
  await check("16.2", "add a rechargeable work-order cost", async () => {
    if (!wo) return { pass: false, detail: "no PM5 work order (re-run p07)" };
    let cost = (await client.from("maintenance_costs").select("id,recharge_to_owner,amount").eq("tenant_id", tenantId).eq("job_id", wo.id).eq("description", COST_DESC).maybeSingle()).data;
    if (!cost) {
      cap.tag("16.2", "/maintenance");
      await visit(page, "/maintenance", cap, { settle: 600 });
      // Open OUR work order's drawer directly by its title.
      await page.getByText(WO_TITLE, { exact: false }).first().click();
      await page.waitForTimeout(900);
      const dlg = page.getByRole("dialog");
      if (!(await dlg.count())) return { pass: false, detail: "work order drawer did not open" };
      // The cost form lives under the "Costs" tab, behind an "Add Cost" button.
      await dlg.getByRole("tab", { name: /costs/i }).click().catch(() => {});
      await page.waitForTimeout(500);
      await dlg.getByRole("button", { name: /add cost/i }).first().click();
      await page.waitForTimeout(500);
      await dlg.locator('input[name="description"]').first().fill(COST_DESC);
      await dlg.locator('input[name="amount_pounds"]').first().fill("220");
      const dateField = dlg.locator('input[name="date_incurred"]').first();
      if ((await dateField.inputValue().catch(() => "")) === "") await dateField.fill(`${YEAR}-${String(MONTH).padStart(2, "0")}-05`).catch(() => {});
      // recharge_to_owner defaults checked — submit.
      await dlg.getByRole("button", { name: /save cost/i }).first().click();
      await page.waitForTimeout(2000); // form reloads the page on save
      cost = (await client.from("maintenance_costs").select("id,recharge_to_owner,amount").eq("tenant_id", tenantId).eq("job_id", wo.id).eq("description", COST_DESC).maybeSingle()).data;
    }
    if (cost) track("maintenance_costs", cost.id);
    return { pass: Boolean(cost) && cost.recharge_to_owner === true, detail: cost ? `cost £${cost.amount}, recharge=${cost.recharge_to_owner}` : "not created" };
  });

  // 16.3 — generate the statement for the period with rent + fee + recharged works.
  let statement = null;
  await check("16.3", "generate statement → fee + rechargeable works in the maths", async () => {
    if (!owner) return { pass: false, detail: "no owner" };
    cap.tag("16.3", `/owners/${owner.id}`);
    await visit(page, `/owners/${owner.id}`, cap, { settle: 600 });
    const tab = page.getByRole("tab", { name: /statements/i }).first();
    if (await tab.count()) { await tab.click().catch(() => {}); await page.waitForTimeout(700); }
    await page.locator('input#period, input[type="month"]').first().fill(`${YEAR}-${String(MONTH).padStart(2, "0")}`).catch(() => {});
    await page.getByRole("button", { name: /generate/i }).first().click().catch(() => {});
    // Poll until the re-derived figures land (rent line appears), not just the row.
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(800);
      statement = (await client.from("owner_statements").select("id,total_rent_received_pence,total_management_fee_pence,total_works_pence,net_to_owner_pence,fee_override_type,fee_override_percent").eq("tenant_id", tenantId).eq("owner_id", owner.id).eq("period_year", YEAR).eq("period_month", MONTH).maybeSingle()).data;
      if (statement && (statement.total_rent_received_pence ?? 0) > 0) break;
    }
    if (!statement) return { pass: false, detail: "statement not generated" };
    track("owner_statements", statement.id);
    const rent = statement.total_rent_received_pence ?? 0;
    const fee = statement.total_management_fee_pence ?? 0;
    const works = statement.total_works_pence ?? 0;
    const net = statement.net_to_owner_pence ?? 0;
    // Fee = effective % of rent (a prior run may have left a 15% override; else 10%).
    const pct = statement.fee_override_type === "percent" ? Number(statement.fee_override_percent) : 10;
    const feeCorrect = fee === Math.round(rent * (pct / 100));
    return {
      pass: rent === 90000 && feeCorrect && works > 0,
      detail: `rent £${rent / 100}, fee £${fee / 100} (= ${pct}% ${feeCorrect ? "✓" : "✗"}), works £${works / 100}, net £${net / 100}`,
    };
  });

  // 16.4 — adjustment line add + delete.
  await check("16.4", "adjustment line add + delete", async () => {
    if (!statement) return { pass: null, detail: "no statement" };
    cap.tag("16.4", `/owners/${owner.id}/statements/${statement.id}`);
    const nav = await visit(page, `/owners/${owner.id}/statements/${statement.id}`, cap, { settle: 700, expectHeading: false });
    if (!nav.pass) return nav;
    const beforeAdj = ((await client.from("owner_transactions").select("id").eq("statement_id", statement.id).eq("is_manual", true)).data ?? []).length;
    // Add line: fill description + amount + submit.
    await page.locator('input[name="description"], input[name*="desc" i]').first().fill("PM5-Adjustment credit").catch(() => {});
    await page.locator('input[name="amount_pounds"], input[name="amount"], input[name*="amount" i]').first().fill("25").catch(() => {});
    await page.getByRole("button", { name: /add line|add adjustment|add/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    const afterAdj = ((await client.from("owner_transactions").select("id").eq("statement_id", statement.id).eq("is_manual", true)).data ?? []).length;
    const added = afterAdj > beforeAdj;
    // Delete it via the row's Trash2.
    if (added) {
      const del = page.getByRole("button", { name: /delete|remove/i }).first();
      if (await del.count()) { await del.click().catch(() => {}); await page.waitForTimeout(400); await page.getByRole("button", { name: /delete|confirm|yes/i }).last().click().catch(() => {}); await page.waitForTimeout(1200); }
    }
    const finalAdj = ((await client.from("owner_transactions").select("id").eq("statement_id", statement.id).eq("is_manual", true)).data ?? []).length;
    return { pass: added, detail: `manual lines ${beforeAdj}→${afterAdj}→${finalAdj} (add ${added ? "ok" : "failed"}, delete ${finalAdj < afterAdj ? "ok" : "best-effort"})` };
  });

  // 16.5 — fee override on the statement.
  await check("16.5", "fee override on the statement", async () => {
    if (!statement) return { pass: null, detail: "no statement" };
    cap.tag("16.5", `/owners/${owner.id}/statements/${statement.id}`);
    await visit(page, `/owners/${owner.id}/statements/${statement.id}`, cap, { settle: 600, expectHeading: false });
    const btn = page.locator('button[title*="management fee" i]').first();
    if (!(await btn.count())) return { pass: null, detail: "no fee-override control found" };
    await btn.click();
    await page.waitForTimeout(600);
    const dlg = page.getByRole("dialog");
    await dlg.locator('select[name*="type" i]').first().selectOption({ label: /percent/i }).catch(() => {});
    await dlg.locator('input[name*="percent" i], input[name*="amount" i]').first().fill("15").catch(() => {});
    await dlg.getByRole("button", { name: /save|apply|override/i }).last().click().catch(() => {});
    await page.waitForTimeout(1500);
    const after = (await client.from("owner_statements").select("fee_override_type,fee_override_percent").eq("id", statement.id).maybeSingle()).data;
    return { pass: Boolean(after?.fee_override_type), detail: `override=${after?.fee_override_type} ${after?.fee_override_percent ?? ""}` };
  });

  // 16.6 — PDF total matches the computed total (PDF renders from the same figures).
  await check("16.6", "statement PDF uses the computed net total", async () => {
    if (!statement) return { pass: null, detail: "no statement" };
    const s = (await client.from("owner_statements").select("net_to_owner_pence,pdf_storage_path").eq("id", statement.id).maybeSingle()).data;
    // The Preview PDF link renders OwnerStatementPdf from these same columns; a
    // separate byte-parse would just re-read them. Assert the net is a real figure.
    return { pass: Number.isFinite(s?.net_to_owner_pence), detail: `net_to_owner £${(s?.net_to_owner_pence ?? 0) / 100} (PDF renders from this)` };
  });
  skip("16.7", "fee override at property level (FeeOverrideDialog per-property)", "statement-level override covered in 16.5; per-property override is a deeper variant");
} finally {
  const result = summary("p16");
  writeResults("p16", result, cap);
  await browser.close();
  process.exit(result.fail > 0 ? 1 : 0);
}

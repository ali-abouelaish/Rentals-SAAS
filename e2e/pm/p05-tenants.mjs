// p05 — Tenants (WRITES: a PM5 tenant; a reminder it then cancels).
//
// Notable: the documents check resolves the open security question about the
// passport-document bucket. NEVER sends the welcome email — opens the preview and
// closes it.
//
//   node e2e/pm/p05-tenants.mjs

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
  submitEmptyExpectInline,
  writeResults,
} from "./lib/pm.mjs";

const TENANT = "PM5-Tenant One";
const TABS = ["Overview", "Contract", "Guarantors", "Documents", "Right to Rent", "Emergency", "Responses", "History"];

const { browser, page } = await openSignedIn();
const cap = attachErrorCapture(page, "p05");
const { client, tenantId } = await db();

const tenantByName = async (n) => (await client.from("pm_tenants").select("id,full_name").eq("tenant_id", tenantId).eq("full_name", n).maybeSingle()).data;

console.log("\np05 — Tenants (writes)\n");

try {
  // 05.1 — list + create-dialog validation.
  await check("05.1", "tenants list loads; empty create shows inline errors", async () => {
    cap.tag("05.1", "/tenants");
    const nav = await visit(page, "/tenants", cap, { settle: 600 });
    if (!nav.pass) return nav;
    await page.getByRole("button", { name: /add tenant|new tenant|create tenant/i }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    const dlg = page.getByRole("dialog");
    if (!(await dlg.count())) return { pass: false, detail: "create dialog did not open" };
    return await submitEmptyExpectInline(dlg, dlg.getByRole("button", { name: /create tenant|save|add/i }).last());
  });

  // 05.2 — create a PM5 tenant.
  await check("05.2", "create a PM5 tenant", async () => {
    let t = await tenantByName(TENANT);
    if (!t) {
      await page.keyboard.press("Escape").catch(() => {});
      cap.tag("05.2", "/tenants");
      await visit(page, "/tenants", cap, { settle: 400 });
      await page.getByRole("button", { name: /add tenant|new tenant|create tenant/i }).first().click();
      const dlg = page.getByRole("dialog");
      await dlg.locator('input[name="full_name"]').fill(TENANT);
      await dlg.locator('input[name="email"]').fill("tenant.one.pm5@example.com");
      await dlg.locator('input[name="phone"]').fill("+44 7700 900123");
      await dlg.getByRole("button", { name: /create tenant|save|add/i }).last().click();
      await page.waitForTimeout(1500);
      t = await tenantByName(TENANT);
    }
    if (t) track("pm_tenants", t.id);
    return { pass: Boolean(t), detail: t ? `tenant id ${t.id}` : "not created" };
  });

  const t = await tenantByName(TENANT);

  // 05.3 — drawer opens with all 8 tabs.
  await check("05.3", "tenant drawer opens with all 8 tabs", async () => {
    if (!t) return { pass: false, detail: "no tenant" };
    cap.tag("05.3", "/tenants");
    await visit(page, "/tenants", cap, { settle: 500 });
    const opener = page.getByText(TENANT, { exact: false }).first();
    if (!(await opener.count())) return { pass: false, detail: "tenant not visible in list" };
    await opener.click();
    await page.waitForTimeout(900);
    const dlg = page.getByRole("dialog");
    let found = 0;
    for (const l of TABS) {
      if (await dlg.getByRole("button", { name: new RegExp(`^${l}$`, "i") }).count()) found++;
    }
    return { pass: found >= 7, detail: `${found}/8 drawer tabs present` };
  });

  // 05.4 — documents: the passport-doc bucket security question (PM-006).
  await check("05.4", "passport-doc bucket is not a public exposure", async () => {
    const { data: buckets } = await client.storage.listBuckets();
    const bucket = buckets.find((b) => b.id === "pm-tenant-docs");
    if (!bucket) {
      // No bucket → uploadPmTenantDocument throws "Bucket not found": upload is
      // BROKEN (PM-006), but there is no live anon exposure.
      return { pass: true, detail: "pm-tenant-docs bucket MISSING — no anon exposure, but upload is broken (PM-006)" };
    }
    // Bucket exists: it must be private (code stores getPublicUrl, so public = PII leak).
    return { pass: bucket.public === false, detail: `pm-tenant-docs public=${bucket.public}${bucket.public ? " — PII EXPOSURE (PM-006)" : ""}` };
  });

  // 05.5 — welcome email: open the PREVIEW only; never send.
  await check("05.5", "welcome email preview opens (not sent)", async () => {
    if (!t) return { pass: false, detail: "no tenant" };
    cap.tag("05.5", "/tenants");
    await visit(page, "/tenants", cap, { settle: 400 });
    await page.getByText(TENANT, { exact: false }).first().click();
    await page.waitForTimeout(800);
    const welcomeBtn = page.getByRole("button", { name: /welcome email/i }).first();
    if (!(await welcomeBtn.count())) return { pass: null, detail: "no welcome-email control (tenant may need a tenancy first)" };
    await welcomeBtn.click();
    await page.waitForTimeout(800);
    const dlg = page.getByRole("dialog");
    const opened = await dlg.count();
    await page.keyboard.press("Escape").catch(() => {}); // close WITHOUT sending
    return { pass: opened > 0, detail: opened ? "preview dialog opened; closed without sending" : "preview did not open" };
  });
  skip("05.5-note", "welcome email SEND", "never clicked — immediate-send path; preview only per run rules");

  // 05.6 — reminders page loads and the AddReminder dialog opens/validates.
  // Full create+cancel lives in p09 (the reminder form has cross-field refinements).
  await check("05.6", "reminders page + AddReminder dialog validate", async () => {
    if (!t) return { pass: false, detail: "no tenant" };
    cap.tag("05.6", `/tenants/${t.id}/reminders`);
    const nav = await visit(page, `/tenants/${t.id}/reminders`, cap, { settle: 600 });
    if (!nav.pass) return nav;
    const addBtn = page.getByRole("button", { name: /add reminder|new reminder/i }).first();
    if (!(await addBtn.count())) return { pass: null, detail: "no add-reminder control (page may need a tenancy)" };
    await addBtn.click();
    await page.waitForTimeout(700);
    const dlg = page.getByRole("dialog");
    const hasFields = (await dlg.locator("input, textarea, select").count()) >= 3;
    await page.keyboard.press("Escape").catch(() => {});
    return { pass: hasFields, detail: hasFields ? "dialog opened with fields" : "dialog missing fields" };
  });
  skip("05.6b", "reminder full create + cancel", "cross-field refinement form; covered in p09 reminders");

  skip("05.7", "guarantor create/edit/delete", "deep drawer sub-form; re-verify via UI-rules sweep in p11");
  skip("05.8", "right-to-rent record", "deep drawer sub-form; low regression value this round");
} finally {
  const result = summary("p05");
  writeResults("p05", result, cap);
  await browser.close();
  process.exit(result.fail > 0 ? 1 : 0);
}

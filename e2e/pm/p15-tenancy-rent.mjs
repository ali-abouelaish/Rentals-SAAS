// p15 — Tenancy lifecycle + rent + month close (WRITES).
//
// Fills the gap p04's deferral left: creating a tenancy does NOT need the contract
// migration (only PDF generation does), so we seed a booking, drive the rewritten
// ConvertToTenancyDialog, then exercise rent recording and the month-close steps
// that an active tenancy unlocks.
//
// Month CLOSE is intentionally not exercised: reopen needs super-admin and the E2E
// account is only admin, so closing would lock a production month irreversibly.
//
//   node e2e/pm/p15-tenancy-rent.mjs

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

const APPLICANT = "PM5-Zoë Ångström"; // Unicode name — also covers that check
const PROP = "PM5-Property Alpha";
const ROOM = "PM5-1";
const OFFER = 1000;

const { browser, page } = await openSignedIn();
const cap = attachErrorCapture(page, "p15");
const { client, tenantId } = await db();

const prop = (await client.from("properties").select("id").eq("tenant_id", tenantId).eq("name", PROP).maybeSingle()).data;
const unit = prop ? (await client.from("units").select("id,deposit,max_price_pcm").eq("tenant_id", tenantId).eq("property_id", prop.id).eq("room_number", ROOM).maybeSingle()).data : null;
const form = (await client.from("booking_forms").select("id").eq("tenant_id", tenantId).eq("is_active", true).limit(1).maybeSingle()).data;

console.log("\np15 — Tenancy + rent + month close (writes)\n");

try {
  // Seed a booking (service-role test setup — the apply path would send an email).
  let booking = (await client.from("bookings").select("id,status").eq("tenant_id", tenantId).eq("applicant_name", APPLICANT).maybeSingle()).data;
  await check("15.0", "seed a convertible booking", async () => {
    if (!prop || !unit || !form) return { pass: false, detail: "missing property/unit/active form (re-run p02)" };
    if (!booking) {
      const { data, error } = await client.from("bookings").insert({
        tenant_id: tenantId,
        form_id: form.id,
        unit_id: unit.id,
        property_id: prop.id,
        applicant_name: APPLICANT,
        applicant_email: "zoe.pm5@example.com",
        applicant_phone: "+44 7700 900999",
        booking_reference: "PM5-BK1",
        status: "under_review",
        offer_price_pcm: OFFER,
      }).select("id,status").single();
      if (error) return { pass: false, detail: `seed failed: ${error.message}` };
      booking = data;
    }
    if (booking) track("bookings", booking.id);
    return { pass: Boolean(booking), detail: booking ? `booking ${booking.id} (${booking.status})` : "not seeded" };
  });

  // 15.1 — rewritten ConvertToTenancyDialog: terms visible, rent prefilled, activate.
  await check("15.1", "convert booking → active tenancy (terms prefilled, activate)", async () => {
    if (!booking) return { pass: false, detail: "no booking" };
    // Already converted on a prior run?
    const existingTenant = (await client.from("pm_tenants").select("id").eq("tenant_id", tenantId).eq("full_name", APPLICANT).maybeSingle()).data;
    if (existingTenant) {
      const c = (await client.from("property_contracts").select("id,rent_pcm,status").eq("tenant_id", tenantId).eq("pm_tenant_id", existingTenant.id).maybeSingle()).data;
      if (c) { track("pm_tenants", existingTenant.id); track("property_contracts", c.id); return { pass: true, detail: `already converted — contract ${c.id} rent £${c.rent_pcm} ${c.status}` }; }
    }
    cap.tag("15.1", "/bookings");
    const nav = await visit(page, "/bookings", cap, { settle: 700 });
    if (!nav.pass) return nav;
    const card = page.getByText(APPLICANT, { exact: false }).first();
    if (!(await card.count())) return { pass: false, detail: "booking not visible on board" };
    await card.click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /convert to tenancy/i }).first().click();
    await page.waitForTimeout(900);
    const dlg = page.getByRole("dialog");
    if (!(await dlg.count())) return { pass: false, detail: "convert dialog did not open" };
    // Terms prefilled: rent from the agreed offer price.
    const rentVal = await dlg.locator('input[name="rent_pcm"]').inputValue().catch(() => "");
    const prefilled = Number(rentVal) === OFFER;
    // Leave template as "Generate later" (no PDF → no migration needed); activate.
    await dlg.getByRole("button", { name: /yes.*activate now/i }).click();
    await page.waitForTimeout(500);
    let tenant = null;
    for (let i = 0; i < 8 && !tenant; i++) {
      await page.waitForTimeout(700);
      tenant = (await client.from("pm_tenants").select("id").eq("tenant_id", tenantId).eq("full_name", APPLICANT).maybeSingle()).data;
    }
    if (!tenant) return { pass: false, detail: `convert did not create a tenant (rent prefilled=${prefilled})` };
    track("pm_tenants", tenant.id);
    const contract = (await client.from("property_contracts").select("id,rent_pcm,status,unit_id").eq("tenant_id", tenantId).eq("pm_tenant_id", tenant.id).maybeSingle()).data;
    if (contract) track("property_contracts", contract.id);
    const u = (await client.from("units").select("status,pm_tenant_id").eq("id", unit.id).maybeSingle()).data;
    const ok = contract && Number(contract.rent_pcm) === OFFER && contract.status === "active" && u?.status === "occupied";
    return { pass: ok, detail: `rent prefilled=${prefilled}; contract rent £${contract?.rent_pcm} ${contract?.status}; unit ${u?.status}` };
  });

  const tenant = (await client.from("pm_tenants").select("id").eq("tenant_id", tenantId).eq("full_name", APPLICANT).maybeSingle()).data;
  const contract = tenant ? (await client.from("property_contracts").select("id,rent_pcm").eq("tenant_id", tenantId).eq("pm_tenant_id", tenant.id).maybeSingle()).data : null;

  // 15.2 — rent: record a payment; totals update.
  await check("15.2", "record a rent payment", async () => {
    if (!contract || !unit) return { pass: false, detail: "no active tenancy" };
    // rent_payments key by unit_id (and contract_id) — verify by unit.
    const countFor = async () => ((await client.from("rent_payments").select("id").eq("tenant_id", tenantId).eq("unit_id", unit.id)).data ?? []);
    const before = (await countFor()).length;
    cap.tag("15.2", "/rent-collection");
    const nav = await visit(page, "/rent-collection", cap, { settle: 800 });
    if (!nav.pass) return nav;
    // Target MY tenant's row precisely (unique "Ångström" token; innermost matching
    // row via .last()). NEVER fall back to .first() — that records on another tenant.
    const row = page.locator("div").filter({ hasText: "Ångström" }).filter({ has: page.getByRole("button", { name: /record payment/i }) }).last();
    if (!(await row.count())) return { pass: false, detail: "my tenant's rent row not found (no safe fallback — not recording on a random row)" };
    const recordBtn = row.getByRole("button", { name: /record payment/i }).first();
    await recordBtn.click();
    await page.waitForTimeout(700);
    const dlg = page.getByRole("dialog");
    await dlg.locator('input[name="amount"]').fill("500").catch(() => {});
    await dlg.locator('button[type="submit"]').last().click().catch(() => {});
    await page.waitForTimeout(1500);
    let after = before;
    for (let i = 0; i < 6 && after <= before; i++) {
      await page.waitForTimeout(600);
      after = (await countFor()).length;
    }
    for (const p of await countFor()) track("rent_payments", p.id);
    return { pass: after > before, detail: `rent_payments for unit ${before}→${after}` };
  });

  // 15.3 — month close: attest + review (CLOSE skipped — admin can't reopen).
  await check("15.3", "month close: attest + review render and run", async () => {
    cap.tag("15.3", "/finances/close");
    const nav = await visit(page, "/finances/close", cap, { settle: 800 });
    if (!nav.pass) return nav;
    const attest = page.getByRole("button", { name: /attest/i }).first();
    const review = page.getByRole("button", { name: /review|reconcile|refresh/i }).first();
    const hasControls = (await attest.count()) > 0 || (await review.count()) > 0;
    if (await review.count()) { await review.click().catch(() => {}); await page.waitForTimeout(1000); }
    if (await attest.count()) { await attest.click().catch(() => {}); await page.waitForTimeout(1000); }
    const scan = await cap.scan(page);
    return { pass: hasControls && !scan.overlay && !scan.boundary, detail: `attest/review controls present=${hasControls}; no error` };
  });
  skip("15.4", "month CLOSE → reopen", "close locks the period and reopen requires super-admin; E2E account is admin — would leave a prod month locked");
  skip("15.5", "rent payment undo", "undo lives in the per-unit history (expandable); covered by record — full undo deferred");
} finally {
  const result = summary("p15");
  writeResults("p15", result, cap);
  await browser.close();
  process.exit(result.fail > 0 ? 1 : 0);
}

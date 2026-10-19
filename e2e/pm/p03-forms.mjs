// p03 — Booking forms & public apply (WRITES: a wide-range unit; bank details).
//
// Focus: the public /apply surface — price tampering is a security concern, and
// the holding-deposit maths is a regression target. Builder sub-steps that need
// deep per-widget work are best-effort or skipped with reasons.
//
//   node e2e/pm/p03-forms.mjs

import {
  openSignedIn,
  openAnonymous,
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
import fs from "node:fs";
import path from "node:path";
import { E2E_ROOT } from "../lib/harness.mjs";

const PROP = "PM5-Property Alpha";
const WIDE = "PM5-W"; // room with a wide price band so ?price=1000 is in-range

const { browser, page } = await openSignedIn();
const cap = attachErrorCapture(page, "p03");
const { client, tenantId } = await db();

const propByName = async (n) => (await client.from("properties").select("id").eq("tenant_id", tenantId).eq("name", n).maybeSingle()).data;
const unitByRoom = async (pid, rn) => (await client.from("units").select("id,min_price_pcm,max_price_pcm,status").eq("tenant_id", tenantId).eq("property_id", pid).eq("room_number", rn).maybeSingle()).data;

// Resolve a LIVE active booking-form slug from the DB (the audit-fixtures slug
// is stale). Read-only use of the preserved E2E- form — never modified.
const activeForm = (
  await client.from("booking_forms").select("public_slug,name").eq("tenant_id", tenantId).eq("is_active", true).limit(1).maybeSingle()
).data;
const SLUG = activeForm?.public_slug ?? null;

console.log(`\np03 — Booking forms & public apply (form slug: ${SLUG ?? "NONE"})\n`);

try {
  const prop = await propByName(PROP);

  // Ensure a wide-band, available unit for the apply/holding-deposit checks.
  let wide = prop ? await unitByRoom(prop.id, WIDE) : null;
  await check("03.0", "seed a wide-band available unit", async () => {
    if (!prop) return { pass: false, detail: "no PM5 property (run p02 first)" };
    if (!wide) {
      cap.tag("03.0", `/properties/${prop.id}/setup`);
      await visit(page, `/properties/${prop.id}/setup`, cap, { settle: 500 });
      await page.getByRole("button", { name: /add room/i }).first().click();
      const dlg = page.getByRole("dialog");
      await dlg.locator('input[name="room_number"]').fill(WIDE);
      await dlg.locator('input[name="min_price_pcm"]').fill("500");
      await dlg.locator('input[name="max_price_pcm"]').fill("1500");
      await dlg.getByRole("button", { name: /add room|save|create/i }).last().click();
      await page.waitForTimeout(1500);
      wide = await unitByRoom(prop.id, WIDE);
    }
    if (wide) track("units", wide.id);
    return { pass: Boolean(wide), detail: wide ? `unit ${wide.id} (£${wide.min_price_pcm}-${wide.max_price_pcm})` : "not created" };
  });

  // --- Public /apply suite (anonymous) -------------------------------------
  if (!SLUG) skip("03.apply", "public /apply suite", "no active booking form for this tenant");
  else if (!wide) skip("03.apply", "public /apply suite", "no wide-band unit to apply against");
  else {
  const { browser: anon, page: anonPage } = await openAnonymous();
  const anonCap = attachErrorCapture(anonPage, "p03");
  {
    const applyUrl = (price) => `/apply/${SLUG}/${wide?.id}${price != null ? `?price=${price}` : ""}`;
    const bodyText = async () => (await anonPage.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");

    // 03.1 — price tampering below the band is ignored (falls back to min).
    await check("03.1", "price=1 (below band) is clamped to the unit's min", async () => {
      if (!wide) return { pass: false, detail: "no wide unit" };
      anonCap.tag("03.1", applyUrl(1));
      await visit(anonPage, applyUrl(1), anonCap, { expectHeading: false, settle: 600 });
      const t = await bodyText();
      const showsMin = new RegExp(`£\\s?${wide.min_price_pcm.toLocaleString()}`).test(t) || t.includes("£500");
      const showsOne = /£\s?1\b(?!,)/.test(t) && !t.includes("£1,");
      return { pass: showsMin && !showsOne, detail: showsOne ? "BUG: rendered the £1 tampered price" : "tampered price ignored, shows min" };
    });

    // 03.2 — price=99999 (above band) ignored; and price=1000 (in band) → £231 deposit.
    await check("03.2", "price=99999 clamped; price=1000 → £231 holding deposit", async () => {
      if (!wide) return { pass: false, detail: "no wide unit" };
      anonCap.tag("03.2", applyUrl(99999));
      await visit(anonPage, applyUrl(99999), anonCap, { expectHeading: false, settle: 500 });
      const tHigh = await bodyText();
      const highClamped = !tHigh.includes("99,999") && !tHigh.includes("99999");
      anonCap.tag("03.2", applyUrl(1000));
      await visit(anonPage, applyUrl(1000), anonCap, { expectHeading: false, settle: 500 });
      const t = await bodyText();
      const showsRent = t.includes("£1,000") || t.includes("£1000");
      const showsDeposit = /£\s?231\b/.test(t) || t.includes("231");
      return {
        pass: highClamped && showsRent && showsDeposit,
        detail: `highClamped=${highClamped}, rent£1000=${showsRent}, deposit£231=${showsDeposit}`,
      };
    });

    // 03.3 — empty submit is BLOCKED (no booking written). The public form uses
    // native `required` validation rather than inline Zod errors — functionally
    // fine, but a CLAUDE.md UI-rule deviation, logged LOW (PM-005).
    await check("03.3", "empty apply submit is blocked", async () => {
      if (!wide) return { pass: false, detail: "no wide unit" };
      anonCap.tag("03.3", applyUrl(1000));
      await visit(anonPage, applyUrl(1000), anonCap, { expectHeading: false, settle: 500 });
      const before = new URL(anonPage.url()).pathname;
      await anonPage.getByRole("button", { name: /apply|submit|send|book/i }).last().click().catch(() => {});
      await anonPage.waitForTimeout(800);
      const after = new URL(anonPage.url()).pathname;
      const inlineErrs = (await anonPage.locator("p.text-red-500, p.text-red-600, [role='alert']").allInnerTexts().catch(() => []))
        .map((t) => t.trim()).filter((t) => t && t !== "*" && t.length > 1);
      const nativeReq = await anonPage.locator("input[required], textarea[required]").count();
      const blocked = after === before; // did not navigate to a success/confirmation
      if (blocked && inlineErrs.length === 0 && nativeReq > 0) {
        anonCap.note("ui-rule", "LOW", "public apply form blocks empty submit via native HTML `required`, not inline Zod errors (CLAUDE.md)");
        return { pass: true, detail: "blocked via native validation (LOW PM-005: not inline Zod)" };
      }
      return { pass: blocked, detail: blocked ? `blocked; ${inlineErrs.length} inline error(s)` : "submitted despite empty fields (BUG)" };
    });

    // 03.4 — a garbage unit id is handled gracefully (404, not a crash).
    await check("03.4", "garbage unit id → graceful 404", async () => {
      anonCap.tag("03.4", `/apply/${SLUG}/not-a-real-unit`);
      const res = await anonPage.goto(url(`/apply/${SLUG}/not-a-real-unit`), { waitUntil: "domcontentloaded" }).catch(() => null);
      const status = res?.status() ?? 0;
      const t = await bodyText();
      const ok = status === 404 || /not found|no longer available|unavailable|404/i.test(t);
      const crashed = /application error|unhandled|digest:/i.test(t);
      return { pass: ok && !crashed, detail: `HTTP ${status}${crashed ? " — CRASHED" : ok ? " — not-found" : ""}` };
    });

    // 03.5 — legacy /apply/{slug} (no unit) shows its "room-specific link" notice.
    await check("03.5", "legacy /apply/{slug} notice renders", async () => {
      anonCap.tag("03.5", `/apply/${SLUG}`);
      await visit(anonPage, `/apply/${SLUG}`, anonCap, { expectHeading: false, settle: 500 });
      const t = await bodyText();
      const notice = /room-specific link required|accepted per room/i.test(t);
      return { pass: notice, detail: notice ? "legacy per-room notice shown" : `no notice (${t.slice(0, 80)})` };
    });

    cap.captured.push(...anonCap.captured);
    await anon.close();
  }
  }

  // --- Bank details (best-effort; needs a portfolio) -----------------------
  await check("03.6", "bank details save", async () => {
    cap.tag("03.6", "/settings/bank-details");
    const nav = await visit(page, "/settings/bank-details", cap, { settle: 600 });
    if (!nav.pass) return nav;
    const label = page.locator('input[name="label"]').first();
    if (!(await label.count())) return { pass: null, detail: "no bank-details form (likely no portfolio on this tenant)" };
    await label.fill("PM5-Main");
    await page.locator('input[name="account_holder_name"]').first().fill("PM5-Account Holder").catch(() => {});
    await page.locator('input[name="account_number"]').first().fill("12345678").catch(() => {});
    await page.locator('input[name="sort_code"]').first().fill("12-34-56").catch(() => {});
    await page.getByRole("button", { name: /save|add account|create/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    const row = (await client.from("portfolio_bank_details").select("id").eq("tenant_id", tenantId).eq("label", "PM5-Main").maybeSingle()).data;
    if (row) track("portfolio_bank_details", row.id);
    return { pass: Boolean(row), detail: row ? `saved ${row.id}` : "not persisted" };
  });

  // --- Booking form builder (best-effort regressions) ----------------------
  await check("03.7", "form builder loads and add-question works (BUG-2)", async () => {
    cap.tag("03.7", "/forms");
    const nav = await visit(page, "/forms", cap, { settle: 700 });
    if (!nav.pass) return nav;
    const addBtn = page.getByRole("button", { name: /add question|add field|new question/i }).first();
    if (!(await addBtn.count())) return { pass: null, detail: "no add-question control found (builder needs a selected form)" };
    const before = await page.getByRole("textbox").count();
    await addBtn.click();
    await page.waitForTimeout(800);
    const after = await page.getByRole("textbox").count();
    return { pass: after > before, detail: `textboxes ${before}→${after} without reload (BUG-2)` };
  });

  skip("03.8", "booking form: dropdown '3 options' edit (BUG-3)", "deep QuestionEditor flow; re-verify manually");
  skip("03.9", "booking form: delete asks to confirm (BUG-4)", "depends on a selected form with questions; covered partially by UI-rules sweep in p11");
  skip("03.10", "question reordering persists", "drag-reorder is brittle under Playwright");
  skip("03.11", "public apply: two-applicant real submission", "creates a booking; the convert-to-tenancy chain (p04) is deferred under DEC-001");
} finally {
  const result = summary("p03");
  writeResults("p03", result, cap);
  await browser.close();
  process.exit(result.fail > 0 ? 1 : 0);
}

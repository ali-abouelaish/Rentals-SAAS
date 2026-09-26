// Seed the few fixtures the mobile audit needs to reach every PM route.
//
//   node e2e/seed-audit-fixtures.mjs
//
// Six detail routes were never measured because the test tenant had no row to
// open: an evaluation, an automation rule, an inbox request. (The others —
// a form, a tenant — already existed; they were simply not linked from their
// list page, so the audit's link-following discovery could not find them. Those
// are resolved by id in `audit-fixtures.json` rather than created here.)
//
// Safety: every write goes through `assertWritableTenant()`, which resolves the
// signed-in E2E account to its actual `tenants.slug` and refuses anything but
// the test tenant. The older text-matching guard cannot be used for this — it
// matches "Property Co.", the hardcoded fallback brand that both Test Tenant
// and Demo Agency render, so it cannot tell them apart.
//
// Idempotent: everything is keyed on an `E2E-AUDIT` marker and reused if found,
// so re-running does not pile up rows.

import fs from "node:fs";
import path from "node:path";
import { assertWritableTenant, E2E_ROOT } from "./lib/harness.mjs";

const MARK = "E2E-AUDIT";
const { db, tenant } = await assertWritableTenant();
const T = tenant.id;

/** Find a row carrying our marker, or create it. */
async function ensure(table, findCol, findVal, row) {
  const { data: found } = await db
    .from(table)
    .select("id")
    .eq("tenant_id", T)
    .eq(findCol, findVal)
    .limit(1);
  if (found?.length) {
    console.log(`  ${table}: reusing ${found[0].id}`);
    return found[0].id;
  }
  const { data, error } = await db
    .from(table)
    .insert({ tenant_id: T, ...row })
    .select("id")
    .single();
  if (error) {
    console.log(`  ${table}: FAILED — ${error.message.slice(0, 120)}`);
    return null;
  }
  console.log(`  ${table}: created ${data.id}`);
  return data.id;
}

const fixtures = {};

// ── 1. An acquisition evaluation → /acquisition-insights/[id] ──────────────
fixtures.evaluationId = await ensure("evaluations", "address", `${MARK} Mill Lane`, {
  address: `${MARK} Mill Lane`,
  postcode: "M1 4WP",
  detected_area: "Manchester",
  property_type: "hmo",
  total_rooms: 5,
  furnished: true,
  status: "considering",
  total_setup_cost: 850000,
  rent_to_landlord_pcm: 180000,
  total_monthly_costs: 220000,
  expected_occupancy_rate: 0.9,
  rooms: [
    { label: "Room 1", price_pcm: 62000 },
    { label: "Room 2", price_pcm: 58000 },
    { label: "Room 3", price_pcm: 60000 },
    { label: "Room 4", price_pcm: 55000 },
    { label: "Room 5", price_pcm: 57000 },
  ],
  projected_monthly_income: 292000,
  monthly_net_profit: 72000,
  break_even_months: 12,
  annual_roi_percentage: 10.16,
});

// ── 2. An automation rule → /automations/rules/[id] ────────────────────────
// Needs a message template to point at; reuse one rather than inventing a
// second fixture, since `template_id` is `on delete restrict`.
const { data: tpl } = await db
  .from("message_templates")
  .select("id")
  .eq("tenant_id", T)
  .limit(1);

if (!tpl?.length) {
  console.log("  automation_rules: SKIPPED — the tenant has no message_templates to reference");
  fixtures.automationRuleId = null;
} else {
  fixtures.automationRuleId = await ensure("automation_rules", "name", `${MARK} Rent reminder`, {
    name: `${MARK} Rent reminder`,
    trigger_type: "date_offset",
    trigger_config: { anchor: "rent_due", offset_days: -3 },
    conditions: [],
    channel: "email",
    template_id: tpl[0].id,
    recipient_config: { to: "tenant" },
    send_hour: 9,
    active: false,
    dry_run: true,
  });
}

// ── 3. A tenant communication request → /inbox/[id] ────────────────────────
const { data: pmT } = await db.from("pm_tenants").select("id").eq("tenant_id", T).limit(1);
if (!pmT?.length) {
  console.log("  tenant_communication_requests: SKIPPED — no pm_tenants in the tenant");
  fixtures.inboxRequestId = null;
} else {
  const { data: existing } = await db
    .from("tenant_communication_requests")
    .select("id")
    .eq("tenant_id", T)
    .contains("payload", { marker: MARK })
    .limit(1);
  if (existing?.length) {
    console.log(`  tenant_communication_requests: reusing ${existing[0].id}`);
    fixtures.inboxRequestId = existing[0].id;
  } else {
    const { data, error } = await db
      .from("tenant_communication_requests")
      .insert({
        tenant_id: T,
        pm_tenant_id: pmT[0].id,
        request_type: "email_change",
        status: "pending",
        payload: { marker: MARK, new_email: "audit.fixture@example.com" },
      })
      .select("id")
      .single();
    if (error) {
      console.log(`  tenant_communication_requests: FAILED — ${error.message.slice(0, 120)}`);
      fixtures.inboxRequestId = null;
    } else {
      console.log(`  tenant_communication_requests: created ${data.id}`);
      fixtures.inboxRequestId = data.id;
    }
  }
}

// ── 4. Rows that already existed but are simply not linked from a list page ──
const pick = async (table, extra = (q) => q) => {
  const { data } = await extra(db.from(table).select("id").eq("tenant_id", T)).limit(1);
  return data?.[0]?.id ?? null;
};
fixtures.formId = await pick("forms");

// Public, renter-facing routes live outside the app shell and are addressed by
// slug/token rather than id — /f/<slug> and /s/<token>. They were never audited
// at all, and they are the pages the agency's own customers see.
const { data: formRow } = await db
  .from("forms")
  .select("public_slug")
  .eq("tenant_id", T)
  .limit(1);
fixtures.formPublicSlug = formRow?.[0]?.public_slug ?? null;

const { data: shareRow } = await db
  .from("property_shares")
  .select("token")
  .eq("tenant_id", T)
  .is("revoked_at", null)
  .limit(1);
fixtures.shareToken = shareRow?.[0]?.token ?? null;
fixtures.pmTenantId = await pick("pm_tenants");
fixtures.contractTemplateId = await pick("contract_templates");

const out = path.join(E2E_ROOT, "audit-fixtures.json");
fs.writeFileSync(out, JSON.stringify({ tenant: tenant.slug, ...fixtures }, null, 2) + "\n");
console.log(`\nWrote ${out}`);
console.log(JSON.stringify(fixtures, null, 2));

// Creates (or refreshes) the isolated demo agency Google's OAuth reviewers log
// into to test "Connect Gmail" + sending an invoice. It never touches any other
// agency: everything is keyed to the DEMO_SLUG tenant.
//
//   DEMO_LANDLORD_EMAIL=you@example.com \
//   node --env-file=.env.local scripts/create-google-review-demo.mjs
//
// Re-running is safe: it resets the reviewer's password (printed at the end)
// and makes sure there is a finalised, unsent invoice ready to send.

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PORTAL_DOMAIN = (process.env.APP_PORTAL_DOMAIN || "harborops.co.uk")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

// Where the demo invoice gets emailed — use an inbox you control so you can
// show it arriving in the demo video.
const LANDLORD_EMAIL = (process.env.DEMO_LANDLORD_EMAIL || "").trim().toLowerCase();
// Agency contact / reply-to address. Defaults to the landlord inbox.
const CONTACT_EMAIL = (process.env.DEMO_CONTACT_EMAIL || LANDLORD_EMAIL).trim().toLowerCase();

const DEMO_SLUG = "google-review";
const DEMO_NAME = "Harbor Ops Demo Lettings";
const REVIEWER_EMAIL = "google-review@harborops.co.uk";
const REVIEWER_NAME = "Google Reviewer";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run with --env-file).");
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(LANDLORD_EMAIL)) {
  console.error("Set DEMO_LANDLORD_EMAIL to an inbox you control (the demo invoice is sent there).");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function must(result, what) {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

/** 20 chars, no look-alikes (0/O, 1/l/I), so it survives being typed from an email. */
function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(20);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function ensureTenant() {
  const existing = must(
    await db.from("tenants").select("id").eq("slug", DEMO_SLUG).maybeSingle(),
    "look up demo tenant"
  );
  if (existing) return existing.id;
  const created = must(
    await db
      .from("tenants")
      .insert({ name: DEMO_NAME, slug: DEMO_SLUG, contact_email: CONTACT_EMAIL, status: "active" })
      .select("id")
      .single(),
    "create demo tenant"
  );
  return created.id;
}

async function findUserIdByEmail(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`list users: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function ensureReviewer(tenantId, password) {
  let userId = await findUserIdByEmail(REVIEWER_EMAIL);
  if (userId) {
    // Never repurpose an account that belongs to a real agency.
    const profile = must(
      await db.from("user_profiles").select("tenant_id").eq("id", userId).maybeSingle(),
      "read reviewer profile"
    );
    if (profile && profile.tenant_id !== tenantId) {
      throw new Error(`${REVIEWER_EMAIL} already belongs to another agency; refusing to touch it.`);
    }
    must(
      await db.auth.admin.updateUserById(userId, { password, email_confirm: true }),
      "reset reviewer password"
    );
  } else {
    const created = must(
      await db.auth.admin.createUser({ email: REVIEWER_EMAIL, password, email_confirm: true }),
      "create reviewer"
    );
    userId = created.user.id;
  }

  must(
    await db
      .from("user_profiles")
      .upsert({ id: userId, tenant_id: tenantId, role: "admin", display_name: REVIEWER_NAME }),
    "upsert reviewer profile"
  );

  const agent = must(
    await db.from("agent_profiles").select("user_id").eq("user_id", userId).maybeSingle(),
    "read agent profile"
  );
  if (!agent) {
    must(
      await db.from("agent_profiles").insert({
        user_id: userId,
        tenant_id: tenantId,
        commission_percent: 0,
        marketing_fee: 0,
        role_flags: { is_agent: true, is_marketing: false },
      }),
      "create agent profile"
    );
  }
  return userId;
}

async function ensureBillingProfile(tenantId) {
  const existing = must(
    await db.from("billing_profiles").select("id").eq("tenant_id", tenantId).limit(1).maybeSingle(),
    "look up billing profile"
  );
  if (existing) return existing.id;
  return must(
    await db
      .from("billing_profiles")
      .insert({
        tenant_id: tenantId,
        name: "Demo billing",
        sender_company_name: DEMO_NAME,
        sender_address: "1 Example Street, London, EC1A 1AA",
        sender_email: CONTACT_EMAIL,
        bank_account_holder_name: DEMO_NAME,
        bank_account_number: "00000000",
        bank_sort_code: "00-00-00",
        default_payment_terms_days: 14,
        footer_thank_you_text: "Demo invoice for review purposes only — no payment is due.",
      })
      .select("id")
      .single(),
    "create billing profile"
  ).id;
}

async function ensureLandlord(tenantId) {
  const existing = must(
    await db
      .from("landlords")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("name", "Demo Landlord")
      .maybeSingle(),
    "look up landlord"
  );
  if (existing) {
    must(
      await db.from("landlords").update({ email: LANDLORD_EMAIL }).eq("id", existing.id),
      "update landlord email"
    );
    return existing.id;
  }
  return must(
    await db
      .from("landlords")
      .insert({ tenant_id: tenantId, name: "Demo Landlord", email: LANDLORD_EMAIL })
      .select("id")
      .single(),
    "create landlord"
  ).id;
}

/** A finalised ("Ready to send") invoice the reviewer can send. Reuses one if it exists. */
async function ensureReadyInvoice(tenantId, userId, billingProfileId, landlordId) {
  const ready = must(
    await db
      .from("invoices")
      .select("invoice_number")
      .eq("tenant_id", tenantId)
      .eq("status", "submitted")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "look up ready invoice"
  );
  if (ready) return ready.invoice_number;

  const invoiceNumber = must(
    await db.rpc("next_invoice_number", { p_tenant_id: tenantId }),
    "next invoice number"
  );
  const issue = new Date();
  const due = new Date(issue);
  due.setDate(due.getDate() + 14);
  const amount = 450;

  const invoice = must(
    await db
      .from("invoices")
      .insert({
        tenant_id: tenantId,
        billing_profile_id: billingProfileId,
        landlord_id: landlordId,
        invoice_number: invoiceNumber,
        issue_date: issue.toISOString().slice(0, 10),
        payment_terms_days: 14,
        due_date: due.toISOString().slice(0, 10),
        status: "submitted",
        submitted_at: issue.toISOString(),
        created_by_user_id: userId,
        notes: "Demo invoice for Google OAuth review.",
        subtotal: amount,
        total: amount,
        balance_due: amount,
      })
      .select("id, invoice_number")
      .single(),
    "create invoice"
  );
  must(
    await db.from("invoice_items").insert({
      tenant_id: tenantId,
      invoice_id: invoice.id,
      description: "Tenant-find fee — Room 2, 1 Example Street",
      quantity: 1,
      rate: amount,
      amount,
      sort_order: 0,
    }),
    "create invoice item"
  );
  return invoice.invoice_number;
}

async function main() {
  console.log(`Supabase project: ${new URL(SUPABASE_URL).host}`);
  const password = generatePassword();
  const tenantId = await ensureTenant();
  const userId = await ensureReviewer(tenantId, password);
  const billingProfileId = await ensureBillingProfile(tenantId);
  const landlordId = await ensureLandlord(tenantId);
  const invoiceNumber = await ensureReadyInvoice(tenantId, userId, billingProfileId, landlordId);

  console.log(`
Demo agency ready (tenant ${tenantId})

  Login URL : https://${DEMO_SLUG}.${PORTAL_DOMAIN}/login
  Email     : ${REVIEWER_EMAIL}
  Password  : ${password}

  Invoice   : ${invoiceNumber} (Ready to send) → ${LANDLORD_EMAIL}
`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});

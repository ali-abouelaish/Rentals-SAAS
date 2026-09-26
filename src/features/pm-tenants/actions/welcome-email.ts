"use server";

/**
 * The welcome / check-in pack a staff member sends from the tenant drawer.
 *
 * Copy lives in the agency's own `tenant_welcome` message template
 * (/automations/templates) — nothing here is hardcoded except the seeded
 * default. Branding is applied automatically from the agency's brand settings.
 *
 * The portal fields are the one wrinkle. {{portal_link}} is a magic link that
 * expires in 20 minutes, so it is deliberately left unresolved in the draft the
 * dialog shows and only minted when Send is clicked — otherwise a staff member
 * who previews, gets distracted and sends half an hour later would post a dead
 * link to the renter.
 */

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { LOGIN_TOKEN_TTL_MS, signPortalToken } from "@/lib/portal/token";
import { loadAgency } from "@/lib/email/agency-context";
import { loadAgencyBrand, type AgencyBrand } from "@/lib/branding/agency-brand";
import { renderMessageBody } from "@/lib/email/blocks";
import { templates } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/send";
import { buildTenantAppUrl } from "@/lib/urls";
import { ensureDefaultTemplates } from "@/features/automations/data/templates";
import {
  WELCOME_MERGE_FIELDS,
  WELCOME_TEMPLATE_KEY,
} from "@/features/automations/domain/mergeFields";
import { buildMergeContext, sharedContext } from "@/features/automations/lib/mergeContext";
import { renderTemplate } from "@/features/automations/lib/render";
import { getTenantMessaging } from "@/features/automations/lib/settings";
import { markPortalInvited } from "@/features/portal/data/queries";
import { welcomeEmailSendSchema, type WelcomeEmailSendValues } from "../domain/schemas";

const ACTIVE_CONTRACT_STATUSES = ["active", "signed", "notice_given"];

/** Keys resolved at send time, so they are not "unknown" in a draft. */
const DEFERRED_KEYS = new Set(WELCOME_MERGE_FIELDS.map((f) => f.key));

export type WelcomeEmailDraft = {
  to: string;
  subject: string;
  body: string;
  /** Label for the record the merge fields were filled from. */
  entityLabel: string;
  /** {{keys}} in the template with nothing to fill them — shown as a warning. */
  unknownKeys: string[];
  /** False when the tenant portal is off: the portal section will come out blank. */
  portalEnabled: boolean;
  /** False when automations is off for this agency — the editor is unreachable. */
  canEditTemplate: boolean;
  /** True when the tenant has no live tenancy, so rent/address fields are thin. */
  missingTenancy: boolean;
  /** The real email, rendered — what the Preview tab shows in an iframe. */
  previewHtml: string;
};

export type WelcomeEmailDraftResult =
  | { ok: true; draft: WelcomeEmailDraft }
  | { ok: false; error: string };

export type WelcomeEmailSendResult = { ok: true } | { ok: false; error: string };

type Loaded = {
  tenantId: string;
  pmTenant: { id: string; full_name: string; email: string };
  template: { subject: string | null; body: string };
  context: Record<string, string>;
  entityLabel: string;
  portalEnabled: boolean;
  canEditTemplate: boolean;
  missingTenancy: boolean;
};

/**
 * Everything both the draft and the send need: the tenant, the agency's
 * template, and the merge context — minus the portal fields.
 */
async function load(pmTenantId: string): Promise<Loaded | { error: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: pmTenant, error } = await supabase
    .from("pm_tenants")
    .select("id, full_name, email")
    .eq("id", pmTenantId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!pmTenant) return { error: "Tenant not found." };
  if (!pmTenant.email?.trim()) {
    return { error: "This tenant has no email address on file." };
  }

  // Seed on demand: an agency that has never opened the templates page still
  // gets the welcome template the first time they reach for this button.
  await ensureDefaultTemplates(profile.tenant_id);

  const admin = createSupabaseAdminClient();
  const { data: template, error: tplErr } = await admin
    .from("message_templates")
    .select("subject, body")
    .eq("tenant_id", profile.tenant_id)
    .eq("key", WELCOME_TEMPLATE_KEY)
    .eq("channel", "email")
    .maybeSingle();
  if (tplErr) return { error: tplErr.message };
  if (!template) return { error: "The welcome email template is missing." };

  // Prefer the live tenancy so rent, address and start date fill in; fall back
  // to the tenant record itself for someone not yet moved in.
  const { data: contract } = await admin
    .from("property_contracts")
    .select("id, status, start_date")
    .eq("tenant_id", profile.tenant_id)
    .eq("pm_tenant_id", pmTenant.id)
    .in("status", ACTIVE_CONTRACT_STATUSES)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const agency = await getTenantMessaging(admin, profile.tenant_id);
  const agencyName = agency?.name ?? "";

  const built = await buildMergeContext(admin, {
    tenantId: profile.tenant_id,
    agencyName,
    entityType: contract ? "tenancy" : "pm_tenant",
    entityId: contract ? (contract.id as string) : pmTenant.id,
  });

  const { data: tenantRow } = await admin
    .from("tenants")
    .select("contact_email")
    .eq("id", profile.tenant_id)
    .maybeSingle();

  const entitlements = await getEntitlements();

  return {
    tenantId: profile.tenant_id,
    pmTenant: {
      id: pmTenant.id as string,
      full_name: (pmTenant.full_name as string) ?? "",
      email: (pmTenant.email as string).trim(),
    },
    template: {
      subject: template.subject as string | null,
      body: template.body as string,
    },
    context: {
      ...(built?.context ?? sharedContext(agencyName)),
      agency_email: ((tenantRow?.contact_email as string | null) ?? "").trim(),
    },
    entityLabel: built?.entityLabel ?? (pmTenant.full_name as string) ?? "Tenant",
    portalEnabled: entitlements.has("tenant_portal"),
    canEditTemplate: entitlements.has("automations"),
    missingTenancy: !contract,
  };
}

/** Mint the send-time portal fields. Fresh token, so it is valid on arrival. */
function portalContext(
  loaded: Loaded,
  slug: string | null,
  enabled: boolean
): Record<string, string> {
  if (!enabled) return { portal_link: "", portal_url: "" };

  const appUrl = buildTenantAppUrl(headers());
  const isLocal = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
  // Staff are on the agency subdomain in production; localhost has none, so
  // carry the slug the way the portal's tenant resolution expects.
  const devSuffix = isLocal && slug ? `&companySlug=${encodeURIComponent(slug)}` : "";

  const token = signPortalToken(
    {
      typ: "login",
      pmTenantId: loaded.pmTenant.id,
      tenantId: loaded.tenantId,
      email: loaded.pmTenant.email.toLowerCase(),
    },
    LOGIN_TOKEN_TTL_MS
  );

  return {
    portal_link: `${appUrl}/portal/auth?token=${encodeURIComponent(token)}${devSuffix}`,
    portal_url:
      isLocal && slug
        ? `${appUrl}/portal/login?companySlug=${encodeURIComponent(slug)}`
        : `${appUrl}/portal/login`,
  };
}

/**
 * Facts for the inset panel at the top of the email. Read from the record, so
 * an agency cannot get them wrong or forget to update them — and omitted
 * individually when the tenant has no tenancy yet.
 */
function buildFactRows(ctx: Record<string, string>): { label: string; value: string }[][] {
  const facts = [
    { label: "Property", value: ctx.property_address ?? "" },
    { label: "Room", value: ctx.unit_name ?? "" },
    { label: "Monthly rent", value: ctx.rent_amount ?? "" },
    { label: "Move-in date", value: ctx.tenancy_start_date ?? "" },
  ].filter((f) => f.value.trim() !== "");

  const rows: { label: string; value: string }[][] = [];
  for (let i = 0; i < facts.length; i += 2) {
    rows.push(facts.slice(i, i + 2));
  }
  return rows;
}

/**
 * Agency copy + agency branding → the finished email. The agency supplies only
 * the body markup; every wrapper, colour and piece of chrome comes from here,
 * so they cannot break the design or inject HTML.
 */
function compose(opts: {
  brand: AgencyBrand;
  contactEmail: string | null;
  subject: string;
  body: string;
  context: Record<string, string>;
}): { html: string; text: string } {
  const { brand } = opts;
  const rendered = renderMessageBody(opts.body, {
    primaryColor: brand.branding.primary_color,
    linkColor: brand.secondaryColor ?? brand.branding.primary_color,
  });

  const html = templates.agencyMessage({
    agency: {
      name: brand.displayName,
      initial: (brand.displayName.trim()[0] ?? "?").toUpperCase(),
      logo_url: brand.branding.logo_url,
      primary_color: brand.branding.primary_color,
      footer_address: brand.branding.footer_address,
      contact_email: opts.contactEmail,
    },
    eyebrow: "Welcome",
    headline: rendered.headline,
    factRows: buildFactRows(opts.context),
    bodyHtml: rendered.html,
    preheader: opts.subject,
  });

  // Plain-text alternate: the same copy with the markup flattened, plus the
  // facts the HTML shows in its panel so text-only readers still get them.
  const factLines = buildFactRows(opts.context)
    .flat()
    .map((f) => `${f.label}: ${f.value}`);
  const signoff = [
    "—",
    brand.displayName,
    opts.contactEmail ?? "",
    brand.branding.footer_address,
  ]
    .filter((line) => line.trim() !== "")
    .join("\n");

  const text = [rendered.headline ?? "", factLines.join("\n"), rendered.text, signoff]
    .filter((section) => section.trim() !== "")
    .join("\n\n");

  return { html, text };
}

/**
 * Render the agency's template against this tenant for review. Portal fields
 * stay as {{placeholders}} — they are filled in on send.
 */
export async function buildWelcomeEmailDraft(
  pmTenantId: string
): Promise<WelcomeEmailDraftResult> {
  const loaded = await load(pmTenantId);
  if ("error" in loaded) return { ok: false, error: loaded.error };

  const body = renderTemplate(loaded.template.body, loaded.context);
  const subject = renderTemplate(loaded.template.subject ?? "", loaded.context);

  const unknownKeys = [
    ...new Set([...body.unknownKeys, ...subject.unknownKeys]),
  ].filter((k) => !DEFERRED_KEYS.has(k));

  const brand = await loadAgencyBrand(loaded.tenantId);
  if (!brand) return { ok: false, error: "Agency not found." };

  return {
    ok: true,
    draft: {
      to: loaded.pmTenant.email,
      subject: subject.text,
      body: body.text,
      entityLabel: loaded.entityLabel,
      unknownKeys,
      portalEnabled: loaded.portalEnabled,
      canEditTemplate: loaded.canEditTemplate,
      missingTenancy: loaded.missingTenancy,
      previewHtml: renderWelcomePreview(loaded, brand, subject.text, body.text),
    },
  };
}

/**
 * Preview of the finished email. The portal placeholders resolve to inert
 * stand-ins so the sign-in button renders at full size without burning a real
 * 20-minute token on a preview that may never be sent.
 */
function renderWelcomePreview(
  loaded: Loaded,
  brand: AgencyBrand,
  subject: string,
  body: string
): string {
  const context = {
    ...loaded.context,
    portal_link: "#preview-only",
    portal_url: "#preview-only",
  };
  return compose({
    brand,
    contactEmail: loaded.context.agency_email || null,
    subject,
    body: renderTemplate(body, context).text,
    context,
  }).html;
}

/**
 * Re-render the draft after an edit in the dialog, so the Preview tab keeps up
 * with what the staff member has typed.
 */
export async function previewWelcomeEmail(
  pmTenantId: string,
  values: WelcomeEmailSendValues
): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const parsed = welcomeEmailSendSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email." };
  }
  const loaded = await load(pmTenantId);
  if ("error" in loaded) return { ok: false, error: loaded.error };

  const brand = await loadAgencyBrand(loaded.tenantId);
  if (!brand) return { ok: false, error: "Agency not found." };

  return {
    ok: true,
    html: renderWelcomePreview(loaded, brand, parsed.data.subject, parsed.data.body),
  };
}

/**
 * Send the welcome email. `values` is what the staff member had on screen, so
 * any last-minute edit is honoured — and re-rendered, so a merge field they
 * typed in the dialog still fills in.
 */
export async function sendWelcomeEmail(
  pmTenantId: string,
  values: WelcomeEmailSendValues
): Promise<WelcomeEmailSendResult> {
  const parsed = welcomeEmailSendSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email." };
  }

  const loaded = await load(pmTenantId);
  if ("error" in loaded) return { ok: false, error: loaded.error };

  const admin = createSupabaseAdminClient();
  const { data: tenantRow } = await admin
    .from("tenants")
    .select("slug")
    .eq("id", loaded.tenantId)
    .maybeSingle();

  const context = {
    ...loaded.context,
    ...portalContext(loaded, (tenantRow?.slug as string | null) ?? null, loaded.portalEnabled),
  };

  const body = renderTemplate(parsed.data.body, context).text;
  const subject = renderTemplate(parsed.data.subject, context).text;

  const [agency, brand] = await Promise.all([
    loadAgency(loaded.tenantId),
    loadAgencyBrand(loaded.tenantId),
  ]);
  if (!agency || !brand) return { ok: false, error: "Agency not found." };

  const { html, text } = compose({
    brand,
    contactEmail: loaded.context.agency_email || null,
    subject,
    body,
    context,
  });

  try {
    await sendEmail(
      loaded.tenantId,
      {
        to: loaded.pmTenant.email,
        subject,
        html,
        text,
        pmTenantId: loaded.pmTenant.id,
        templateKey: WELCOME_TEMPLATE_KEY,
      },
      { agency }
    );
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send the welcome email.",
    };
  }

  // The email carries a portal sign-in link, so this counts as the invite.
  if (loaded.portalEnabled) {
    await markPortalInvited(loaded.tenantId, loaded.pmTenant.id);
  }

  return { ok: true };
}

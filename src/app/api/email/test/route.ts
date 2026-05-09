import { NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { loadAgency } from "@/lib/email/agency-context";
import { sendAgencyEmail } from "@/lib/email/agency-send";
import {
  templates,
  buildContext,
  renderPlainText,
  type CommunicationRequestEmailContext,
} from "@/lib/email/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TEMPLATES = ["rent_due", "rent_overdue", "communication_request"] as const;
type TemplateKey = (typeof TEMPLATES)[number];

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  rent_due: "Rent due",
  rent_overdue: "Rent overdue",
  communication_request: "Inbox notification",
};

const SAMPLE_PROPERTY_ADDRESS = "12 Sample Road, London SW1 1AA";
const SAMPLE_TENANT_NAME = "Sample Tenant";

/**
 * Render any of the three email templates with sample data and send it to a
 * recipient provided by an authenticated admin. Used to preview branding.
 */
export async function POST(request: Request) {
  const profile = await requireUserProfile();

  let to = "";
  let template: TemplateKey = "rent_due";
  try {
    const body = (await request.json().catch(() => null)) as {
      to?: unknown;
      template?: unknown;
    } | null;
    to = String(body?.to ?? "").trim().toLowerCase();
    const t = String(body?.template ?? "rent_due");
    if ((TEMPLATES as readonly string[]).includes(t)) template = t as TemplateKey;
  } catch {
    to = "";
  }

  if (!to || !EMAIL_RE.test(to)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY is not set on the server." }, { status: 500 });
  }
  if (!process.env.EMAIL_FROM_DOMAIN) {
    return NextResponse.json({ ok: false, error: "EMAIL_FROM_DOMAIN is not set on the server." }, { status: 500 });
  }

  const agency = await loadAgency(profile.tenant_id);
  if (!agency) {
    return NextResponse.json({ ok: false, error: "Agency not found" }, { status: 404 });
  }

  const fromAddress = `noreply@${process.env.EMAIL_FROM_DOMAIN as string}`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://harborops.co.uk";
  const agencyName = agency.name || agency.branding.from_display_name;

  let subject = "";
  let html = "";
  let text = "";

  if (template === "rent_due") {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5);
    const ctx = buildContext({
      branding: agency.branding,
      agencyName,
      pmTenantName: SAMPLE_TENANT_NAME,
      pmTenantId: profile.id,
      propertyAddress: SAMPLE_PROPERTY_ADDRESS,
      amountPence: 1450,
      dueDate,
      appUrl,
    });
    subject = `[TEST] Rent due preview - ${agencyName}`;
    html = templates.rentDue(ctx);
    text = renderPlainText("due", ctx);
  } else if (template === "rent_overdue") {
    const wasDue = new Date();
    wasDue.setDate(wasDue.getDate() - 7);
    const ctx = buildContext({
      branding: agency.branding,
      agencyName,
      pmTenantName: SAMPLE_TENANT_NAME,
      pmTenantId: profile.id,
      propertyAddress: SAMPLE_PROPERTY_ADDRESS,
      amountPence: 1450,
      dueDate: wasDue,
      daysOverdue: 7,
      appUrl,
    });
    subject = `[TEST] Rent overdue preview - ${agencyName}`;
    html = templates.rentOverdue(ctx);
    text = renderPlainText("overdue", ctx);
  } else {
    // communication_request
    const requestUrl = `${appUrl.replace(/\/$/, "")}/inbox/00000000-0000-0000-0000-000000000000`;
    const ctx: CommunicationRequestEmailContext = {
      agency: {
        name: agencyName,
        logo_url: agency.branding.logo_url,
        primary_color: agency.branding.primary_color,
        accent_color: agency.branding.accent_color,
      },
      tenant: { name: SAMPLE_TENANT_NAME },
      property: { address: SAMPLE_PROPERTY_ADDRESS },
      requestTypeLabel: "Email change",
      summary:
        "Current: sample.tenant@old-email.com\nRequested: sample.tenant@new-email.com",
      requestUrl,
    };
    subject = `[TEST] Inbox notification preview - ${agencyName}`;
    html = templates.communicationRequest(ctx);
    text = [
      `New ${ctx.requestTypeLabel} request from ${ctx.tenant.name}`,
      `Property: ${ctx.property.address}`,
      "",
      ctx.summary,
      "",
      `Review: ${requestUrl}`,
    ].join("\n");
  }

  console.log("[email] test send attempt", {
    tenantId: profile.tenant_id,
    template,
    from: fromAddress,
    to,
  });

  try {
    // Inbox-notification templates are agency-internal, so omit the
    // unsubscribe header by skipping pmTenantId for that variant.
    const { providerId } = await sendAgencyEmail({
      agency,
      to,
      subject,
      html,
      text,
      pmTenantId: template === "communication_request" ? undefined : profile.id,
    });
    console.log("[email] test send succeeded", { providerId, template, from: fromAddress, to });
    return NextResponse.json({
      ok: true,
      providerId,
      sentTo: to,
      fromAddress,
      template,
      templateLabel: TEMPLATE_LABELS[template],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] test send failed", { template, from: fromAddress, to, error: message });
    return NextResponse.json(
      { ok: false, error: message, fromAddress, sentTo: to, template },
      { status: 500 }
    );
  }
}

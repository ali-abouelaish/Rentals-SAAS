import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadAgency } from "@/lib/email/agency-context";
import { sendAgencyEmail } from "@/lib/email/agency-send";

const PROVIDER_LABELS: Record<string, string> = {
  graph: "Microsoft 365",
  gmail: "Gmail",
  smtp: "custom SMTP",
};

/**
 * Mark an agency's custom email provider as errored and, on the transition into
 * the error state, alert the agency so a dead connection doesn't silently stop
 * their mail. Re-alerting is suppressed while the provider stays errored — the
 * alert fires once, when active → error. Best-effort: never throws.
 *
 * Shared by every custom transport (Graph/Gmail/SMTP) and the dispatcher's
 * fallback path.
 */
export async function failEmailProvider(tenantId: string, reason: string): Promise<void> {
  const admin = createSupabaseAdminClient();

  let wasActive = false;
  let providerType = "";
  try {
    const { data } = await admin
      .from("email_providers")
      .select("status, type")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    wasActive = (data?.status as string | undefined) !== "error";
    providerType = (data?.type as string | undefined) ?? "";

    await admin
      .from("email_providers")
      .update({ status: "error", last_error: reason.slice(0, 500) })
      .eq("tenant_id", tenantId);
  } catch (err) {
    console.error("[email] failed to mark provider error", { tenantId, err });
  }

  if (!wasActive) return;

  try {
    const agency = await loadAgency(tenantId);
    if (!agency) return;
    const label = PROVIDER_LABELS[providerType] ?? "email";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://harborops.co.uk";
    const settingsUrl = `${appUrl}/settings/email`;
    await sendAgencyEmail({
      agency,
      to: await resolveAlertRecipient(tenantId),
      subject: "Action needed: reconnect your email sending",
      html: `<p>Your ${escapeHtml(label)} email connection for ${escapeHtml(agency.name)} has stopped working and needs attention.</p>
<p>Your emails are still being delivered via the default Harbor Ops mailer in the meantime, but they will not send from your own address until you fix the connection.</p>
<p><a href="${settingsUrl}">Review your email connection</a></p>
<p style="color:#64748b;font-size:12px">Reason: ${escapeHtml(reason).slice(0, 200)}</p>`,
      text: `Your ${label} email connection for ${agency.name} has stopped working and needs attention.\n\nYour emails are still being delivered via the default Harbor Ops mailer in the meantime, but they will not send from your own address until you fix the connection.\n\nReview: ${settingsUrl}\n\nReason: ${reason.slice(0, 200)}`,
      templateKey: "provider_connection_alert",
    });
  } catch (err) {
    console.error("[email] failed to send provider down alert", { tenantId, err });
  }
}

async function resolveAlertRecipient(tenantId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("contact_email")
    .eq("id", tenantId)
    .maybeSingle();
  const contact = ((data?.contact_email as string | null) ?? "").trim();
  if (!contact) throw new Error(`Tenant ${tenantId} has no contact_email for alerting`);
  return contact;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

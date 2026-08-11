import type { Agency } from "./branding";
import { logEmail } from "./log";
import { logEmailSendError } from "./error-log";
import { ResendTransport } from "./transport/resend";

export type SendAgencyEmailParams = {
  agency: Agency;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** pm_tenants.id — used in the List-Unsubscribe mailto subject so we can identify the recipient.
   *  Omit for non-tenant-facing mail (e.g. agency self-notifications); the
   *  unsubscribe header is suppressed when missing. */
  pmTenantId?: string;
  /** Recorded in email_log.template_key for auditing. */
  templateKey?: string;
};

export type SendAgencyEmailResult = { providerId: string };

/**
 * Send a branded email via the central Resend mailer, ALWAYS — ignoring any
 * per-agency custom provider.
 *
 * Reserved for system→agency mail that must not depend on the agency's own
 * mailbox: Harbor Ops notifications (notify-agency/creation/marketing-claim)
 * and, critically, the "your email provider failed" alert in
 * email-providers/alert.ts. Everything tenant-facing (outbox drain, reminders,
 * portal invites, form links) goes through sendEmail(), which resolves the
 * agency's connected transport and falls back to Resend. From is pinned to the
 * central Harbor Ops mailer; reply-to is the agency's contact_email — refuses
 * to send if unset. Every attempt is recorded in email_log.
 */
export async function sendAgencyEmail({
  agency,
  to,
  subject,
  html,
  text,
  pmTenantId,
  templateKey,
}: SendAgencyEmailParams): Promise<SendAgencyEmailResult> {
  const transport = new ResendTransport(agency);
  try {
    const { messageId } = await transport.send({ to, subject, html, text, pmTenantId, templateKey });
    await logEmail({
      tenantId: agency.id,
      providerType: "resend_default",
      to,
      subject,
      templateKey,
      messageId,
      status: "sent",
    });
    return { providerId: messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEmail({
      tenantId: agency.id,
      providerType: "resend_default",
      to,
      subject,
      templateKey,
      status: "failed",
      error: message,
    });
    await logEmailSendError({
      tenantId: agency.id,
      message,
      context: { path: "agency-send", to, subject },
    });
    throw err;
  }
}

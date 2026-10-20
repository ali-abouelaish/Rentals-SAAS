import { loadAgency } from "./agency-context";
import { logEmail } from "./log";
import { logEmailSendError } from "./error-log";
import { getTransport } from "./transport/factory";
import { ResendTransport } from "./transport/resend";
import { getEmailProvider } from "@/lib/email-providers/data";
import { failEmailProvider } from "@/lib/email-providers/alert";
import { isFeatureEnabledForTenant } from "@/lib/entitlements/tenantFeature";
import type { Agency } from "./branding";
import type { EmailMessage, EmailProviderType } from "./transport/types";

/** Microsoft Graph's inline-attachment ceiling — the strictest of our transports. */
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

export type SendEmailResult = {
  /** Transport message id. On the Resend default path this is the Resend id
   *  (load-bearing: persisted to rent_reminder_log.email_provider_id and
   *  correlated by the Resend webhook). */
  providerId: string;
  providerType: EmailProviderType;
};

/**
 * Send an email on behalf of an agency, resolving the transport at call time.
 *
 * If the agency has an active custom provider (graph/gmail/smtp) the mail goes
 * out from their mailbox; otherwise it falls through to the central Resend
 * mailer, byte-for-byte as sendAgencyEmail always has. Every attempt is
 * recorded in email_log (success and failure).
 *
 * Pass a preloaded `agency` via ctx to avoid a redundant tenants read (the rent
 * reminder batch already holds one).
 */
export async function sendEmail(
  tenantId: string,
  message: EmailMessage,
  ctx?: { agency?: Agency },
): Promise<SendEmailResult> {
  // Checked before a transport is chosen: an oversized message is the caller's
  // problem, and must not reach the custom-provider failure path below, which
  // would wrongly flag the agency's mailbox as broken.
  const attachmentBytes = (message.attachments ?? []).reduce((sum, a) => sum + a.content.length, 0);
  if (attachmentBytes > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      `Attachments total ${(attachmentBytes / 1024 / 1024).toFixed(1)} MB; the limit is 3 MB.`,
    );
  }

  const agency = ctx?.agency ?? (await loadAgency(tenantId));
  if (!agency) throw new Error(`Agency ${tenantId} not found`);

  // A super admin can switch Email Sending off. The connected mailbox is then
  // ignored — not deleted — and mail goes out exactly as if none were connected,
  // so nothing stops sending and switching it back on resumes the mailbox.
  const [emailSendingOn, provider] = await Promise.all([
    isFeatureEnabledForTenant(tenantId, "email_sending"),
    getEmailProvider(tenantId),
  ]);
  const config = emailSendingOn ? provider : null;
  const transport = getTransport(agency, config);

  try {
    const { messageId } = await transport.send(message);
    await logEmail({
      tenantId,
      providerType: transport.type,
      to: message.to,
      subject: message.subject,
      templateKey: message.templateKey,
      messageId,
      status: "sent",
    });
    return { providerId: messageId, providerType: transport.type };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logEmail({
      tenantId,
      providerType: transport.type,
      to: message.to,
      subject: message.subject,
      templateKey: message.templateKey,
      status: "failed",
      error: errorMessage,
    });
    await logEmailSendError({
      tenantId,
      message: errorMessage,
      context: { path: "send", to: message.to, subject: message.subject, provider: transport.type },
    });

    // A custom provider (Graph/Gmail/SMTP) failed: flag the agency (mark the
    // provider errored + alert once) and fall back to the default Resend mailer
    // so the email still goes out. The default mailer has no fallback.
    if (transport.type !== "resend_default") {
      await failEmailProvider(tenantId, errorMessage);
      return sendViaResendFallback(agency, tenantId, message);
    }
    throw err;
  }
}

async function sendViaResendFallback(
  agency: Agency,
  tenantId: string,
  message: EmailMessage,
): Promise<SendEmailResult> {
  try {
    const { messageId } = await new ResendTransport(agency).send(message);
    await logEmail({
      tenantId,
      providerType: "resend_default",
      to: message.to,
      subject: message.subject,
      templateKey: message.templateKey ? `${message.templateKey}:fallback` : "fallback",
      messageId,
      status: "sent",
    });
    return { providerId: messageId, providerType: "resend_default" };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logEmail({
      tenantId,
      providerType: "resend_default",
      to: message.to,
      subject: message.subject,
      templateKey: message.templateKey ? `${message.templateKey}:fallback` : "fallback",
      status: "failed",
      error: errorMessage,
    });
    await logEmailSendError({
      tenantId,
      message: errorMessage,
      context: { path: "send:fallback", to: message.to, subject: message.subject },
    });
    throw err;
  }
}

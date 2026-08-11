import { loadAgency } from "./agency-context";
import { logEmail } from "./log";
import { logEmailSendError } from "./error-log";
import { getTransport } from "./transport/factory";
import { ResendTransport } from "./transport/resend";
import { getEmailProvider } from "@/lib/email-providers/data";
import { failEmailProvider } from "@/lib/email-providers/alert";
import type { Agency } from "./branding";
import type { EmailMessage, EmailProviderType } from "./transport/types";

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
  const agency = ctx?.agency ?? (await loadAgency(tenantId));
  if (!agency) throw new Error(`Agency ${tenantId} not found`);

  const config = await getEmailProvider(tenantId);
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

import "server-only";

import { coreResendSend } from "@/lib/email/resend-core";
import { logEmail } from "@/lib/email/log";

/**
 * Platform mail with no agency behind it (the website's demo requests): the central Harbor
 * Resend sender, recorded in email_log with no tenant. Never throws; returns whether it was sent.
 */
export async function sendPlatformEmail({
  to,
  replyTo,
  subject,
  html,
  text,
  templateKey,
}: {
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  templateKey: string;
}): Promise<boolean> {
  const domain = process.env.EMAIL_FROM_DOMAIN?.trim();
  if (!domain) {
    console.warn("[demo-requests.email] EMAIL_FROM_DOMAIN is not set; skipping", templateKey);
    return false;
  }
  try {
    const { messageId } = await coreResendSend({
      from: `Harbor <noreply@${domain}>`,
      to,
      replyTo,
      subject,
      html,
      text,
    });
    await logEmail({ tenantId: null, providerType: "resend_default", to, subject, templateKey, messageId, status: "sent" });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEmail({ tenantId: null, providerType: "resend_default", to, subject, templateKey, status: "failed", error: message });
    console.error("[demo-requests.email] send failed", templateKey, err);
    return false;
  }
}

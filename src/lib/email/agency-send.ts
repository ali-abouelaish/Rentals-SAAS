import { getResendClient } from "./resend-client";
import type { Agency } from "./branding";
import { loadAgencyContactEmail } from "./contact";
import { logEmailSendError } from "./error-log";

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
};

export type SendAgencyEmailResult = { providerId: string };

/**
 * Send a branded email on behalf of an agency.
 *
 * From is pinned to the central Harbor Ops mailer; per-agency display name
 * and custom-domain sending are paused pending a redo of branding.
 * Reply-to is the agency's contact_email — refuses to send if unset.
 */
export async function sendAgencyEmail({
  agency,
  to,
  subject,
  html,
  text,
  pmTenantId,
}: SendAgencyEmailParams): Promise<SendAgencyEmailResult> {
  const fallbackDomain = process.env.EMAIL_FROM_DOMAIN;
  if (!fallbackDomain) {
    throw new Error("EMAIL_FROM_DOMAIN is not set");
  }

  const from = `Harbor Ops <noreply@${fallbackDomain}>`;
  const replyTo = await loadAgencyContactEmail(agency.id);

  const headers: Record<string, string> = {};
  if (pmTenantId) {
    const unsubscribeMailto = `mailto:unsubscribe@${fallbackDomain}?subject=${encodeURIComponent(pmTenantId)}`;
    headers["List-Unsubscribe"] = `<${unsubscribeMailto}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const resend = getResendClient();
  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
      reply_to: replyTo,
      headers,
    });
    // The Resend HTTP API returns rejections (unverified domain, bad from,
    // rate limits, etc.) as an `error` object rather than throwing. Surface it
    // so the outbox drain retries and logEmailSendError records it.
    if (error) {
      throw new Error(`${error.name}: ${error.message}`);
    }
    return { providerId: data?.id ?? "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEmailSendError({
      tenantId: agency.id,
      message,
      context: { path: "agency-send", to, subject },
    });
    throw err;
  }
}

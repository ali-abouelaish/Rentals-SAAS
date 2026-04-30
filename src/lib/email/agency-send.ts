import { getTransporter } from "./transporter";
import type { Agency } from "./branding";

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
 * From address rules:
 *   - branding.custom_domain + custom_domain_verified  -> noreply@<custom_domain>
 *   - otherwise                                        -> noreply@<EMAIL_FROM_DOMAIN>
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

  const useCustom =
    !!agency.branding.custom_domain && agency.branding.custom_domain_verified;
  const sendingDomain = useCustom
    ? (agency.branding.custom_domain as string)
    : fallbackDomain;

  const fromAddress = `noreply@${sendingDomain}`;
  const displayName = agency.branding.from_display_name || agency.name;
  const from = `"${displayName.replace(/"/g, "'")}" <${fromAddress}>`;
  // Replies always route to the central Harbor Ops mailbox so they reach a
  // monitored inbox even if an agency hasn't configured their own reply-to.
  const replyTo = "info@harborops.co.uk";

  const headers: Record<string, string> = {};
  if (pmTenantId) {
    const unsubscribeMailto = `mailto:unsubscribe@${fallbackDomain}?subject=${encodeURIComponent(pmTenantId)}`;
    headers["List-Unsubscribe"] = `<${unsubscribeMailto}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
    replyTo,
    headers,
  });

  const providerId = info.messageId ?? "";
  return { providerId };
}

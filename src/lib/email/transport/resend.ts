import { coreResendSend } from "../resend-core";
import { loadAgencyContactEmail } from "../contact";
import type { Agency } from "../branding";
import type { EmailMessage, Transport, TransportResult } from "./types";

/**
 * The system-default transport: sends via central Resend, exactly as
 * sendAgencyEmail always has.
 *
 * From is pinned to the central Harbor Ops mailer (per-agency display name and
 * custom-domain sending remain paused). Reply-to is the agency's contact_email
 * unless the message overrides it — refuses to send if unset.
 */
export class ResendTransport implements Transport {
  readonly type = "resend_default" as const;

  constructor(private readonly agency: Agency) {}

  async send(message: EmailMessage): Promise<TransportResult> {
    const fallbackDomain = process.env.EMAIL_FROM_DOMAIN;
    if (!fallbackDomain) {
      throw new Error("EMAIL_FROM_DOMAIN is not set");
    }

    const from = message.from ?? `Harbor Ops <noreply@${fallbackDomain}>`;
    const replyTo = message.replyTo ?? (await loadAgencyContactEmail(this.agency.id));

    const headers: Record<string, string> = {};
    if (message.pmTenantId) {
      const unsubscribeMailto = `mailto:unsubscribe@${fallbackDomain}?subject=${encodeURIComponent(message.pmTenantId)}`;
      headers["List-Unsubscribe"] = `<${unsubscribeMailto}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    return coreResendSend({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo,
      headers,
    });
  }
}

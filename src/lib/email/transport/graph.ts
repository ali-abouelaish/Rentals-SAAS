import type { Agency } from "../branding";
import type {
  EmailMessage,
  EmailProviderConfig,
  OAuthCredentials,
  Transport,
  TransportResult,
} from "./types";

/**
 * Microsoft Graph transport — sends from an agency's own Microsoft 365 mailbox
 * via POST /users/{mailbox}/sendMail (raw REST, no SDK).
 *
 * SCAFFOLD: activated by a future admin UI + OAuth consent flow that populates
 * email_providers.credentials. Until then no tenant has a graph provider, so
 * this code path is never taken. Access-token refresh persistence is a TODO for
 * that follow-up (see refreshIfNeeded below).
 */
export class GraphTransport implements Transport {
  readonly type = "graph" as const;

  constructor(
    private readonly agency: Agency,
    private readonly config: EmailProviderConfig,
  ) {}

  async send(message: EmailMessage): Promise<TransportResult> {
    const creds = this.config.credentials as OAuthCredentials | null;
    const mailbox = message.from ?? this.config.fromAddress;
    if (!creds || !mailbox) {
      throw new Error(`Graph provider for tenant ${this.agency.id} is misconfigured`);
    }

    const accessToken = await this.refreshIfNeeded(creds);
    const replyTo = message.replyTo ?? this.config.replyTo ?? undefined;

    const payload = {
      message: {
        subject: message.subject,
        body: { contentType: "HTML", content: message.html },
        toRecipients: [{ emailAddress: { address: message.to } }],
        ...(replyTo ? { replyTo: [{ emailAddress: { address: replyTo } }] } : {}),
      },
      saveToSentItems: true,
    };

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Graph sendMail failed (${res.status}): ${detail}`);
    }

    // sendMail returns 202 Accepted with no body — Graph does not expose a
    // message id here, so there is no provider id to correlate.
    return { messageId: "" };
  }

  /**
   * TODO(follow-up): when the access token is near expiry, exchange the refresh
   * token at the Microsoft identity endpoint and persist the new token set back
   * to email_providers.credentials. For now we use the stored access token as-is.
   */
  private async refreshIfNeeded(creds: OAuthCredentials): Promise<string> {
    return creds.accessToken;
  }
}

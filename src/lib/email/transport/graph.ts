import { getValidGraphAccessToken } from "@/lib/email-providers/graph/tokens";
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
 * via the delegated POST /me/sendMail endpoint (raw REST, no SDK).
 *
 * The access token is refreshed (and persisted) as needed by
 * getValidGraphAccessToken; a dead refresh token surfaces as a GraphAuthError
 * and flips the provider to status='error'.
 */
export class GraphTransport implements Transport {
  readonly type = "graph" as const;

  constructor(
    private readonly agency: Agency,
    private readonly config: EmailProviderConfig,
  ) {}

  async send(message: EmailMessage): Promise<TransportResult> {
    const creds = this.config.credentials as OAuthCredentials | null;
    const mailbox = this.config.fromAddress;
    if (!creds || !mailbox) {
      throw new Error(`Graph provider for tenant ${this.agency.id} is misconfigured`);
    }

    const accessToken = await getValidGraphAccessToken(this.config.tenantId, creds);
    const replyTo = message.replyTo ?? this.config.replyTo ?? undefined;
    // From must be the authenticated mailbox (delegated Mail.Send); a display
    // name is allowed alongside it.
    const fromAddress = message.from ?? mailbox;

    const payload = {
      message: {
        subject: message.subject,
        body: { contentType: "HTML", content: message.html },
        from: {
          emailAddress: {
            address: fromAddress,
            ...(this.config.fromName ? { name: this.config.fromName } : {}),
          },
        },
        toRecipients: [{ emailAddress: { address: message.to } }],
        ...(replyTo ? { replyTo: [{ emailAddress: { address: replyTo } }] } : {}),
      },
      saveToSentItems: true,
    };

    const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Graph sendMail failed (${res.status}): ${detail}`);
    }

    // sendMail returns 202 Accepted with no body — Graph does not expose a
    // message id here, so there is no provider id to correlate.
    return { messageId: "" };
  }
}

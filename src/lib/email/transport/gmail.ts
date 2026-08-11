import { google } from "googleapis";
import { getValidGmailAccessToken } from "@/lib/email-providers/gmail/tokens";
import type { Agency } from "../branding";
import type {
  EmailMessage,
  EmailProviderConfig,
  OAuthCredentials,
  Transport,
  TransportResult,
} from "./types";

/**
 * Gmail transport — sends from an agency's own Google Workspace / Gmail mailbox
 * via the Gmail API (users.messages.send, gmail.send scope). The access token
 * is refreshed + persisted by getValidGmailAccessToken; a dead refresh token
 * surfaces as a GmailAuthError and flags the provider.
 */
export class GmailTransport implements Transport {
  readonly type = "gmail" as const;

  constructor(
    private readonly agency: Agency,
    private readonly config: EmailProviderConfig,
  ) {}

  async send(message: EmailMessage): Promise<TransportResult> {
    const creds = this.config.credentials as OAuthCredentials | null;
    const fromAddress = this.config.fromAddress;
    if (!creds || !fromAddress) {
      throw new Error(`Gmail provider for tenant ${this.agency.id} is misconfigured`);
    }

    const accessToken = await getValidGmailAccessToken(this.config.tenantId, creds);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: "v1", auth });
    const raw = buildRawMessage({
      from: this.config.fromName ? `${this.config.fromName} <${fromAddress}>` : fromAddress,
      to: message.to,
      subject: message.subject,
      html: message.html,
      replyTo: message.replyTo ?? this.config.replyTo ?? undefined,
    });

    const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    return { messageId: res.data.id ?? "" };
  }
}

/** Build a base64url-encoded RFC 822 HTML message. */
function buildRawMessage({
  from,
  to,
  subject,
  html,
  replyTo,
}: {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): string {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
  ];
  const mime = `${headers.join("\r\n")}\r\n\r\n${html}`;
  return Buffer.from(mime)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

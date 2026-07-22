import { google } from "googleapis";
import { getOAuthClient } from "@/lib/gmail/oauthClient";
import type { Agency } from "../branding";
import type {
  EmailMessage,
  EmailProviderConfig,
  OAuthCredentials,
  Transport,
  TransportResult,
} from "./types";

/**
 * Gmail transport — sends from an agency's own Google Workspace mailbox via the
 * Gmail API (users.messages.send). Reuses the existing Google OAuth client
 * (src/lib/gmail/oauthClient.ts); note the send scope (gmail.send) differs from
 * the inbound lead-ingestion scope (gmail.readonly).
 *
 * SCAFFOLD: activated by a future admin UI + OAuth consent flow that populates
 * email_providers.credentials. googleapis refreshes the access token in-memory
 * from the stored refresh token; persisting the rotated token back to
 * email_providers is a TODO for that follow-up.
 */
export class GmailTransport implements Transport {
  readonly type = "gmail" as const;

  constructor(
    private readonly agency: Agency,
    private readonly config: EmailProviderConfig,
  ) {}

  async send(message: EmailMessage): Promise<TransportResult> {
    const creds = this.config.credentials as OAuthCredentials | null;
    const fromAddress = message.from ?? this.config.fromAddress;
    if (!creds || !fromAddress) {
      throw new Error(`Gmail provider for tenant ${this.agency.id} is misconfigured`);
    }

    const auth = getOAuthClient();
    auth.setCredentials({
      access_token: creds.accessToken,
      refresh_token: creds.refreshToken,
      expiry_date: Date.parse(creds.expiry) || undefined,
    });

    const gmail = google.gmail({ version: "v1", auth });
    const raw = buildRawMessage({
      from: fromAddress,
      to: message.to,
      subject: message.subject,
      html: message.html,
      replyTo: message.replyTo ?? this.config.replyTo ?? undefined,
    });

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

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

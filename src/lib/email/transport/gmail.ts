import { google } from "googleapis";
import { getValidGmailAccessToken } from "@/lib/email-providers/gmail/tokens";
import type { Agency } from "../branding";
import type {
  EmailAttachment,
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
      from: this.config.fromName
        ? `${encodeHeader(this.config.fromName)} <${fromAddress}>`
        : fromAddress,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo ?? this.config.replyTo ?? undefined,
      attachments: message.attachments,
    });

    const res = await gmail.users.messages.send(
      { userId: "me", requestBody: { raw } },
      // No default timeout; a stalled request would hang the sender.
      { timeout: 30_000 },
    );
    return { messageId: res.data.id ?? "" };
  }
}

const CRLF = "\r\n";

/** RFC 2047 encoded-word, so non-ASCII (e.g. "£") survives a header. */
function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** Base64 wrapped at 76 columns, as MIME requires for body parts. */
function base64Lines(content: Buffer | string): string {
  const b64 = (typeof content === "string" ? Buffer.from(content, "utf8") : content).toString(
    "base64",
  );
  return (b64.match(/.{1,76}/g) ?? []).join(CRLF);
}

function makeBoundary(tag: string): string {
  return `=_${tag}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * Build a base64url-encoded RFC 822 message: multipart/alternative (text +
 * HTML), wrapped in multipart/mixed when there are attachments. Every part is
 * base64-encoded so UTF-8 bodies and binary files survive intact.
 */
function buildRawMessage({
  from,
  to,
  subject,
  html,
  text,
  replyTo,
  attachments,
}: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}): string {
  const altBoundary = makeBoundary("alt");
  const alternative = [
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(text),
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(html),
    `--${altBoundary}--`,
  ];

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
  ];

  let lines: string[];
  if (attachments?.length) {
    const mixedBoundary = makeBoundary("mixed");
    lines = [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
      "",
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      "",
      ...alternative,
      ...attachments.flatMap((a) => {
        const name = encodeHeader(a.filename.replace(/["\r\n]/g, ""));
        return [
          `--${mixedBoundary}`,
          `Content-Type: ${a.contentType}; name="${name}"`,
          `Content-Disposition: attachment; filename="${name}"`,
          "Content-Transfer-Encoding: base64",
          "",
          base64Lines(a.content),
        ];
      }),
      `--${mixedBoundary}--`,
    ];
  } else {
    lines = [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      "",
      ...alternative,
    ];
  }

  return Buffer.from(lines.join(CRLF))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

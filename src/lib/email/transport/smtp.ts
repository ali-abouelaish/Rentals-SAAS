import nodemailer from "nodemailer";
import type { Agency } from "../branding";
import type {
  EmailMessage,
  EmailProviderConfig,
  SmtpCredentials,
  Transport,
  TransportResult,
} from "./types";

/**
 * SMTP transport — sends via an agency's own SMTP server using nodemailer.
 *
 * SCAFFOLD: activated by a future admin UI that populates
 * email_providers.credentials with the SMTP host/port/user/pass. Until then no
 * tenant has an smtp provider, so this path is never taken.
 */
export class SmtpTransport implements Transport {
  readonly type = "smtp" as const;

  constructor(
    private readonly agency: Agency,
    private readonly config: EmailProviderConfig,
  ) {}

  async send(message: EmailMessage): Promise<TransportResult> {
    const creds = this.config.credentials as SmtpCredentials | null;
    const fromAddress = message.from ?? this.buildFrom();
    if (!creds || !fromAddress) {
      throw new Error(`SMTP provider for tenant ${this.agency.id} is misconfigured`);
    }

    const transporter = nodemailer.createTransport({
      host: creds.host,
      port: creds.port,
      secure: creds.secure,
      auth: { user: creds.user, pass: creds.pass },
    });

    const info = await transporter.sendMail({
      from: fromAddress,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo ?? this.config.replyTo ?? undefined,
    });

    return { messageId: info.messageId ?? "" };
  }

  private buildFrom(): string | null {
    if (!this.config.fromAddress) return null;
    return this.config.fromName
      ? `${this.config.fromName} <${this.config.fromAddress}>`
      : this.config.fromAddress;
  }
}

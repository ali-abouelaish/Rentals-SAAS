import nodemailer from "nodemailer";
import type { SmtpCredentials } from "@/lib/email/transport/types";

/**
 * Verify SMTP credentials by opening a connection and authenticating
 * (transporter.verify) without sending anything. Throws a readable error on
 * failure so the save action can surface it to the agency.
 */
export async function verifySmtp(creds: SmtpCredentials): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    auth: { user: creds.user, pass: creds.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  });
  try {
    await transporter.verify();
  } finally {
    transporter.close();
  }
}

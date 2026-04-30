import nodemailer, { type Transporter } from "nodemailer";

let cached: Transporter | null = null;

/**
 * Resend SMTP transport, pooled. Reused across invocations on a warm Vercel
 * lambda. The pool keeps up to 5 simultaneous connections open.
 */
export function getTransporter(): Transporter {
  if (cached) return cached;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  cached = nodemailer.createTransport({
    host: "smtp.resend.com",
    port: 465,
    secure: true,
    auth: { user: "resend", pass: apiKey },
    pool: true,
    maxConnections: 5,
    // Surface real Resend rejections (unverified domain, bad from, etc.)
    // rather than letting a transient socket error get cached.
    logger: false,
    debug: false,
  });

  return cached;
}

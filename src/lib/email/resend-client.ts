import { Resend } from "resend";

let cached: Resend | null = null;

/**
 * Resend API client, cached across warm-lambda invocations.
 *
 * Sends go over the Resend HTTP API (not SMTP), so failures surface as an
 * `error` object on the send response rather than a thrown socket error.
 */
export function getResendClient(): Resend {
  if (cached) return cached;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  cached = new Resend(apiKey);
  return cached;
}

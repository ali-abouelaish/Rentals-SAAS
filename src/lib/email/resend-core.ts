import { getResendClient } from "./resend-client";

export type CoreResendSendParams = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo: string;
  headers?: Record<string, string>;
};

/**
 * Low-level Resend send. Shared by sendAgencyEmail and the Resend transport so
 * the single Resend code path can't drift.
 *
 * The Resend HTTP API returns rejections (unverified domain, bad from, rate
 * limits, etc.) as an `error` object rather than throwing — this surfaces them
 * as a thrown Error so callers can log/retry. Does NOT write email_log; the
 * calling dispatcher owns logging.
 */
export async function coreResendSend({
  from,
  to,
  subject,
  html,
  text,
  replyTo,
  headers,
}: CoreResendSendParams): Promise<{ messageId: string }> {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
    reply_to: replyTo,
    headers: headers ?? {},
  });
  if (error) {
    throw new Error(`${error.name}: ${error.message}`);
  }
  return { messageId: data?.id ?? "" };
}

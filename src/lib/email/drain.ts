import { claimNextBatch, markFailed, markFailedPermanent, markSent } from "./outbox";
import { sendEmail } from "./send";
import { loadAgency } from "./agency-context";
import { MissingContactEmailError } from "./contact";
import { logEmailSendError } from "./error-log";

export type DrainResult = { claimed: number; sent: number; failed: number };

/**
 * Claim a batch of queued emails and attempt delivery.
 *
 * Safe to run concurrently across processes (or PM2 cluster instances) —
 * claimNextBatch uses FOR UPDATE SKIP LOCKED so no row is claimed twice.
 * Per-row failures are logged / marked and swallowed so a single bad row can't
 * stall the queue.
 *
 * Delivery goes through sendEmail, so agencies with a connected mailbox
 * (Gmail / Microsoft 365 / SMTP) send from their own address — with automatic
 * fallback to the central Resend mailer — and unconnected agencies keep the
 * central mailer, byte-for-byte as before.
 */
export async function drainEmailOutbox(limit = 10): Promise<DrainResult> {
  const batch = await claimNextBatch(limit);

  let sent = 0;
  let failed = 0;

  for (const row of batch) {
    // Permanent failure: a row with no tenant_id was enqueued incorrectly.
    if (!row.tenant_id) {
      const message = "email_outbox row has no tenant_id; cannot resolve agency";
      await markFailedPermanent(row.id, message);
      await logEmailSendError({
        tenantId: null,
        message,
        context: { path: "email-drain", outboxId: row.id, to: row.to, subject: row.subject },
      });
      failed++;
      continue;
    }

    const agency = await loadAgency(row.tenant_id);
    if (!agency) {
      const message = `Agency ${row.tenant_id} not found for outbox row`;
      await markFailedPermanent(row.id, message);
      await logEmailSendError({
        tenantId: row.tenant_id,
        message,
        context: { path: "email-drain", outboxId: row.id, to: row.to, subject: row.subject },
      });
      failed++;
      continue;
    }

    try {
      const { providerId } = await sendEmail(
        row.tenant_id,
        {
          to: row.to,
          subject: row.subject,
          html: row.html,
          text: row.text ?? "",
          templateKey: "outbox",
        },
        { agency }
      );
      await markSent(row.id, providerId);
      sent++;
    } catch (err) {
      // Missing contact_email won't be fixed by retrying — fail permanently and
      // log here (the Resend transport throws this before its own logging).
      // Other failures are already logged inside sendEmail; just queue the retry.
      if (err instanceof MissingContactEmailError) {
        await markFailedPermanent(row.id, err.message);
        await logEmailSendError({
          tenantId: row.tenant_id,
          message: err.message,
          context: { path: "email-drain", outboxId: row.id, to: row.to, subject: row.subject },
        });
      } else {
        const message = err instanceof Error ? err.message : String(err);
        await markFailed(row.id, message);
      }
      failed++;
    }
  }

  return { claimed: batch.length, sent, failed };
}

import { NextResponse } from "next/server";
import { claimNextBatch, markFailed, markFailedPermanent, markSent } from "@/lib/email/outbox";
import { sendAgencyEmail } from "@/lib/email/agency-send";
import { loadAgency } from "@/lib/email/agency-context";
import { MissingContactEmailError } from "@/lib/email/contact";
import { logEmailSendError } from "@/lib/email/error-log";

/** Set EMAIL_WORKER_SECRET in env; requests must send x-worker-secret header with this value. */
const EMAIL_WORKER_SECRET = process.env.EMAIL_WORKER_SECRET;

export async function POST(request: Request) {
  const secret = request.headers.get("x-worker-secret");
  if (!EMAIL_WORKER_SECRET || secret !== EMAIL_WORKER_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const limit = 10;
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
        context: { path: "email-worker", outboxId: row.id, to: row.to, subject: row.subject },
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
        context: { path: "email-worker", outboxId: row.id, to: row.to, subject: row.subject },
      });
      failed++;
      continue;
    }

    try {
      const { providerId } = await sendAgencyEmail({
        agency,
        to: row.to,
        subject: row.subject,
        html: row.html,
        text: row.text ?? "",
      });
      await markSent(row.id, providerId);
      sent++;
    } catch (err) {
      // Missing contact_email won't be fixed by retrying — fail permanently
      // and log here (sendAgencyEmail throws this before its own logging).
      // SMTP failures are already logged inside sendAgencyEmail; just queue
      // the retry.
      if (err instanceof MissingContactEmailError) {
        await markFailedPermanent(row.id, err.message);
        await logEmailSendError({
          tenantId: row.tenant_id,
          message: err.message,
          context: { path: "email-worker", outboxId: row.id, to: row.to, subject: row.subject },
        });
      } else {
        const message = err instanceof Error ? err.message : String(err);
        await markFailed(row.id, message);
      }
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    claimed: batch.length,
    sent,
    failed,
  });
}

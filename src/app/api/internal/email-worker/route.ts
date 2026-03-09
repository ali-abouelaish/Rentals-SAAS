import { NextResponse } from "next/server";
import { claimNextBatch, markFailed, markSent } from "@/lib/email/outbox";
import { sendEmailSES } from "@/lib/email/ses";

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
    try {
      const { messageId } = await sendEmailSES({
        to: row.to,
        subject: row.subject,
        html: row.html,
        text: row.text ?? undefined,
      });
      await markSent(row.id, messageId);
      sent++;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      await markFailed(row.id, errorMessage);
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

import { Prisma } from "@/generated/prisma/client";
import type { EmailOutbox } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Backoff delays in minutes: 1m, 5m, 15m, 60m, 6h */
const BACKOFF_MINUTES = [1, 5, 15, 60, 360];

export type EnqueueEmailParams = {
  tenantId?: string | null;
  to: string;
  subject: string;
  html: string;
  text?: string | null;
};

/**
 * Insert a new email into the outbox with status queued.
 */
export async function enqueueEmail({
  tenantId,
  to,
  subject,
  html,
  text,
}: EnqueueEmailParams): Promise<{ id: string }> {
  const row = await prisma.emailOutbox.create({
    data: {
      tenantId: tenantId ?? undefined,
      to,
      subject,
      html,
      text: text ?? undefined,
      status: "queued",
    },
    select: { id: true },
  });
  return { id: row.id };
}

/**
 * Atomically claim up to `limit` queued rows (sendAfter <= now, attempts < 5),
 * marking them as sending. Returns the claimed rows. Uses FOR UPDATE SKIP LOCKED.
 */
export async function claimNextBatch(
  limit = 10
): Promise<EmailOutbox[]> {
  const rows = await prisma.$transaction(async (tx) => {
    const claimedIds = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        WITH to_claim AS (
          SELECT id FROM email_outbox
          WHERE status = 'queued'
            AND send_after <= now()
            AND attempts < 5
          ORDER BY send_after ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE email_outbox
        SET status = 'sending', updated_at = now()
        FROM to_claim
        WHERE email_outbox.id = to_claim.id
        RETURNING id
      `
    );
    if (claimedIds.length === 0) {
      return [];
    }
    const ids = claimedIds.map((r) => r.id);
    return tx.emailOutbox.findMany({
      where: { id: { in: ids } },
    });
  });
  return rows as EmailOutbox[];
}

/**
 * Mark a claimed row as sent and store the provider message id.
 */
export async function markSent(
  id: string,
  messageId: string
): Promise<void> {
  await prisma.emailOutbox.update({
    where: { id },
    data: {
      status: "sent",
      providerMessageId: messageId,
      lastError: null,
    },
  });
}

/**
 * Mark a claimed row as failed: increment attempts, set lastError.
 * If attempts < 5: set status back to queued and sendAfter = now + backoff.
 * If attempts >= 5: set status to failed.
 */
export async function markFailed(id: string, error: string): Promise<void> {
  const row = await prisma.emailOutbox.findUnique({
    where: { id },
    select: { attempts: true },
  });
  if (!row) return;

  const nextAttempts = row.attempts + 1;
  const isFinalFailure = nextAttempts >= 5;

  const backoffMinutes = BACKOFF_MINUTES[Math.min(row.attempts, BACKOFF_MINUTES.length - 1)];
  const sendAfter = new Date(Date.now() + backoffMinutes * 60 * 1000);

  await prisma.emailOutbox.update({
    where: { id },
    data: {
      attempts: nextAttempts,
      lastError: error,
      status: isFinalFailure ? "failed" : "queued",
      ...(isFinalFailure ? {} : { sendAfter }),
    },
  });
}

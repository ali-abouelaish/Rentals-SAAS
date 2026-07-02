import { NextResponse } from "next/server";
import { drainEmailOutbox } from "@/lib/email/drain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Set EMAIL_WORKER_SECRET in env; requests must send x-worker-secret header with this value. */
const EMAIL_WORKER_SECRET = process.env.EMAIL_WORKER_SECRET;

/**
 * Drains a batch of the email_outbox queue on demand. Kept for manual triggering
 * and any external scheduler; the app also drains the queue in-process on an
 * interval (see src/instrumentation.ts).
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-worker-secret");
  if (!EMAIL_WORKER_SECRET || secret !== EMAIL_WORKER_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { claimed, sent, failed } = await drainEmailOutbox(10);
  return NextResponse.json({ ok: true, claimed, sent, failed });
}

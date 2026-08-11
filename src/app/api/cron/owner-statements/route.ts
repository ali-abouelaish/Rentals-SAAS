import { NextResponse } from "next/server";
import { runOwnerStatements } from "@/lib/cron/ownerStatements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Owner statements run in-process via src/instrumentation.ts (node-cron) at
 * 06:00 on the 1st. This endpoint is the manual/backup trigger, guarded by
 * CRON_SECRET. The job re-checks it is the 1st in Europe/London, so calling
 * this on any other day is a no-op that reports why it skipped.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runOwnerStatements();
  return NextResponse.json(summary);
}

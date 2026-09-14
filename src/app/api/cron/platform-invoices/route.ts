import { NextResponse } from "next/server";
import { runPlatformInvoices } from "@/lib/cron/platformInvoices";
import { withJobRun } from "@/lib/cron/jobRuns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Platform invoices run in-process via src/instrumentation.ts (node-cron) at
 * 06:30 on the 1st. This endpoint is the manual/backup trigger, guarded by
 * CRON_SECRET. The job re-checks it is the 1st in Europe/London, so calling
 * this on any other day is a no-op that reports why it skipped.
 *
 * Generates DRAFTS only. An invoice already issued or paid is never rewritten,
 * so this is safe to call repeatedly.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await withJobRun("platform-invoices", "manual", runPlatformInvoices);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

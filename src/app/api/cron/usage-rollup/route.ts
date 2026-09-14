import { NextResponse } from "next/server";
import { runUsageRollup } from "@/lib/cron/usageRollup";
import { withJobRun } from "@/lib/cron/jobRuns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Usage rollup runs in-process via src/instrumentation.ts (node-cron) at 05:00
 * on the 1st, ahead of platform-invoices. This endpoint is the manual/backup
 * trigger, guarded by CRON_SECRET.
 *
 * `?force=1` runs it on any day of the month, for backfilling a month that was
 * missed. It still measures the month that just closed, and still refuses to
 * touch a tenant whose resulting invoice has already been issued or paid.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";

  try {
    const summary = await withJobRun("usage-rollup", "manual", () =>
      runUsageRollup({ force })
    );
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

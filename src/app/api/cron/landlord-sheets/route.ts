import { NextResponse } from "next/server";
import { runLandlordSheets } from "@/lib/cron/landlordSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Reads are network-bound and run sequentially; give the sweep room to finish.
export const maxDuration = 300;

/**
 * Landlord-spreadsheet reads run in-process via src/instrumentation.ts
 * (node-cron, daily at 07:20 Europe/London). This endpoint remains as a
 * manual/backup trigger, guarded by CRON_SECRET. Safe to call any time — each
 * sheet's daily cadence is re-checked, so an extra call does not force early
 * re-reads.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runLandlordSheets();
  return NextResponse.json(summary);
}

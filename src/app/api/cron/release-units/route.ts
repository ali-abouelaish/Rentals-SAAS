import { NextResponse } from "next/server";
import { runReleaseMovedOutUnits } from "@/lib/cron/releaseMovedOutUnits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Releasing moved-out rooms runs in-process via src/instrumentation.ts (node-cron,
 * daily at 00:05 Europe/London). This endpoint remains as a manual/backup trigger,
 * guarded by CRON_SECRET. Safe to call any time — it only flips rooms already
 * marked move_out whose available_date has arrived.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runReleaseMovedOutUnits();
  return NextResponse.json(summary);
}

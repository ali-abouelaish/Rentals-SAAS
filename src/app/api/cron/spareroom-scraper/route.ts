import { NextResponse } from "next/server";
import { runSpareroomScraper } from "@/lib/cron/spareroomScraper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A full roster is a long walk — the script paces itself between advert pages to
// stay polite to SpareRoom — so give the sweep the room the schedule gives it.
export const maxDuration = 3600;

/**
 * The SpareRoom scrape runs in-process via src/instrumentation.ts (node-cron,
 * daily at 09:00 Europe/London). The schedule itself lives in
 * src/lib/cron/jobCatalogue.ts — check there rather than trusting this line.
 * This endpoint is the manual/backup trigger, guarded by CRON_SECRET.
 *
 * Safe to call any time: runs are serialised by flock, so an overlapping call
 * fails fast on the lock rather than sweeping rows another run just wrote.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runSpareroomScraper();
  return NextResponse.json(summary);
}

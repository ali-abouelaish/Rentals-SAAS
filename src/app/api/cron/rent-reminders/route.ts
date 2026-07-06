import { NextResponse } from "next/server";
import { runRentReminders } from "@/lib/cron/rentReminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rent reminders run in-process via src/instrumentation.ts (node-cron). This
 * endpoint remains as a manual/backup trigger, guarded by CRON_SECRET. The job
 * itself only sends inside the Europe/London 09:00 window.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runRentReminders();
  return NextResponse.json(summary);
}

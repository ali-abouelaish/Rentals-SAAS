import { NextResponse } from "next/server";
import { runMessageDrain } from "@/lib/cron/messageDrain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduled-messages drain runs in-process via src/instrumentation.ts
 * (node-cron, every 5 minutes). This endpoint remains as a manual/backup
 * trigger, guarded by CRON_SECRET.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runMessageDrain();
  return NextResponse.json(summary);
}

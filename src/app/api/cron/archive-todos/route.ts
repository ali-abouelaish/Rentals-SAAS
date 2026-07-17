import { NextResponse } from "next/server";
import { runArchiveCompletedTodos } from "@/lib/cron/archiveTodos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Completed-task archiving runs in-process via src/instrumentation.ts (node-cron,
 * daily at 03:00 Europe/London). This endpoint remains as a manual/backup trigger,
 * guarded by CRON_SECRET. Safe to call any time — it only touches completed tasks
 * that haven't been archived yet.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runArchiveCompletedTodos();
  return NextResponse.json(summary);
}

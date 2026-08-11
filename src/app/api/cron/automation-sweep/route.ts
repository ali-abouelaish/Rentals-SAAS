import { NextResponse } from "next/server";
import { runAutomationSweep } from "@/lib/cron/automationSweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Automation-rule sweep runs in-process via src/instrumentation.ts (node-cron,
 * 08:30 London daily). This endpoint remains as a manual/backup trigger,
 * guarded by CRON_SECRET.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runAutomationSweep();
  return NextResponse.json(summary);
}

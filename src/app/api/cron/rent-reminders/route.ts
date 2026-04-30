import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDueReminders, type DueReminder } from "@/lib/email/reminder-rules";
import { loadAgency } from "@/lib/email/agency-context";
import { sendAgencyEmail } from "@/lib/email/agency-send";
import { templates, buildContext, renderPlainText } from "@/lib/email/render";
import type { Agency } from "@/lib/email/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduled hourly by Vercel; only proceeds if the current hour in
 * Europe/London is 09. Handles BST/GMT switch automatically.
 */
function isLondonNineAM(now: Date): boolean {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    hour12: false,
  });
  const hour = parseInt(fmt.format(now), 10);
  return hour === 9;
}

const SUBJECTS: Record<DueReminder["reminderType"], string> = {
  upcoming_3d: "Rent reminder: payment due in 3 days",
  due_today:   "Rent reminder: payment due today",
  // Retained for type completeness; the cron windows no longer emit these.
  upcoming_5d: "Rent reminder: payment due in 5 days",
  overdue_3d:  "Rent overdue: 3 days",
  overdue_7d:  "Rent overdue: 1 week",
  overdue_14d: "Rent overdue: 2 weeks",
};

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const now = new Date();

  if (!isLondonNineAM(now)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Outside Europe/London 09:00 send window",
      processed: 0,
      sent: 0,
      failed: 0,
      durationMs: Date.now() - startedAt,
    });
  }

  const reminders = await getDueReminders(now);
  if (reminders.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      sent: 0,
      failed: 0,
      durationMs: Date.now() - startedAt,
    });
  }

  const admin = createSupabaseAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://harborops.co.uk";

  // Cache agencies across the batch — many reminders share the same agency.
  const agencyCache = new Map<string, Agency | null>();
  async function getAgency(tenantId: string): Promise<Agency | null> {
    if (agencyCache.has(tenantId)) return agencyCache.get(tenantId) ?? null;
    const a = await loadAgency(tenantId);
    agencyCache.set(tenantId, a);
    return a;
  }

  const results = await Promise.allSettled(
    reminders.map(async (r) => processOne(r, admin, getAgency, appUrl))
  );

  let sent = 0;
  let failed = 0;
  for (const result of results) {
    if (result.status === "fulfilled" && result.value === "sent") sent++;
    else failed++;
  }

  return NextResponse.json({
    ok: true,
    processed: reminders.length,
    sent,
    failed,
    durationMs: Date.now() - startedAt,
  });
}

async function processOne(
  r: DueReminder,
  admin: ReturnType<typeof createSupabaseAdminClient>,
  getAgency: (tenantId: string) => Promise<Agency | null>,
  appUrl: string
): Promise<"sent" | "failed"> {
  const isOverdue = r.reminderType.startsWith("overdue_");
  const subject = SUBJECTS[r.reminderType];

  try {
    const agency = await getAgency(r.tenantId);
    if (!agency) throw new Error(`Agency ${r.tenantId} not found`);

    const ctx = buildContext({
      branding: agency.branding,
      agencyName: agency.name || agency.branding.from_display_name,
      pmTenantName: r.pmTenantName,
      pmTenantId: r.pmTenantId,
      propertyAddress: r.propertyAddress,
      amountPence: r.amountPcm,
      dueDate: new Date(r.periodStart),
      daysOverdue: isOverdue ? r.daysOverdue : undefined,
      appUrl,
    });

    const html = isOverdue ? templates.rentOverdue(ctx) : templates.rentDue(ctx);
    const text = renderPlainText(isOverdue ? "overdue" : "due", ctx);

    const { providerId } = await sendAgencyEmail({
      agency,
      to: r.pmTenantEmail,
      subject,
      html,
      text,
      pmTenantId: r.pmTenantId,
    });

    const { error } = await admin.from("rent_reminder_log").insert({
      tenant_id: r.tenantId,
      contract_id: r.contractId,
      pm_tenant_id: r.pmTenantId,
      reminder_type: r.reminderType,
      period_start: r.periodStart,
      email_provider_id: providerId,
      status: "sent",
    });
    if (error) {
      console.error("[email] failed to log sent reminder", {
        contractId: r.contractId,
        type: r.reminderType,
        error: error.message,
      });
    }
    return "sent";
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[email] reminder send failed", {
      contractId: r.contractId,
      type: r.reminderType,
      error: errorMessage,
    });
    // Log the failure so the unique constraint stops us re-trying tomorrow.
    const { error } = await admin.from("rent_reminder_log").insert({
      tenant_id: r.tenantId,
      contract_id: r.contractId,
      pm_tenant_id: r.pmTenantId,
      reminder_type: r.reminderType,
      period_start: r.periodStart,
      status: "failed",
      error_message: errorMessage.slice(0, 500),
    });
    if (error) {
      console.error("[email] failed to log failed reminder", error.message);
    }
    return "failed";
  }
}

// Rent-reminder job. Extracted from the /api/cron/rent-reminders route so it can
// be driven by either the in-process scheduler (src/lib/cron/scheduler.ts) or an
// HTTP trigger. Only sends when the current hour in Europe/London is 09 — safe to
// invoke more often (the London-9AM guard + the rent_reminder_log unique
// constraint prevent duplicate sends).

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDueReminders, type DueReminder } from "@/lib/email/reminder-rules";
import { loadAgency } from "@/lib/email/agency-context";
import { sendEmail } from "@/lib/email/send";
import { templates, buildContext, renderPlainText } from "@/lib/email/render";
import type { Agency } from "@/lib/email/branding";

export type RentReminderSummary = {
  ok: true;
  skipped?: boolean;
  reason?: string;
  processed: number;
  sent: number;
  failed: number;
  /** Reminders skipped because a concurrent run already claimed the slot. */
  deduped?: number;
  durationMs: number;
};

/**
 * Only proceeds if the current hour in Europe/London is 09. Handles the BST/GMT
 * switch automatically.
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

/** Run the rent-reminder send. `now` is injectable for tests. */
export async function runRentReminders(now: Date = new Date()): Promise<RentReminderSummary> {
  const startedAt = Date.now();

  if (!isLondonNineAM(now)) {
    return {
      ok: true,
      skipped: true,
      reason: "Outside Europe/London 09:00 send window",
      processed: 0,
      sent: 0,
      failed: 0,
      durationMs: Date.now() - startedAt,
    };
  }

  const reminders = await getDueReminders(now);
  if (reminders.length === 0) {
    return { ok: true, processed: 0, sent: 0, failed: 0, durationMs: Date.now() - startedAt };
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
  let deduped = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value === "sent") sent++;
      else if (result.value === "deduped") deduped++;
      else failed++;
    } else {
      failed++;
    }
  }

  return {
    ok: true,
    processed: reminders.length,
    sent,
    failed,
    deduped,
    durationMs: Date.now() - startedAt,
  };
}

async function processOne(
  r: DueReminder,
  admin: ReturnType<typeof createSupabaseAdminClient>,
  getAgency: (tenantId: string) => Promise<Agency | null>,
  appUrl: string
): Promise<"sent" | "failed" | "deduped"> {
  const isOverdue = r.reminderType.startsWith("overdue_");
  const subject = SUBJECTS[r.reminderType];

  // Claim the (contract_id, period_start, reminder_type) slot BEFORE sending.
  // The unique constraint on rent_reminder_log means only one concurrent run
  // wins this insert; any other run (in-process scheduler + HTTP trigger, or a
  // PM2 cluster worker) gets a 23505 conflict and must NOT send. Sending first
  // and logging afterwards — as this used to do — let two overlapping runs both
  // pass getDueReminders' "already sent?" filter and deliver duplicate emails.
  // We insert an optimistic "sent" row and downgrade it to "failed" only if the
  // send throws (the status CHECK allows just 'sent'|'failed').
  const { data: claim, error: claimErr } = await admin
    .from("rent_reminder_log")
    .insert({
      tenant_id: r.tenantId,
      contract_id: r.contractId,
      pm_tenant_id: r.pmTenantId,
      reminder_type: r.reminderType,
      period_start: r.periodStart,
      status: "sent",
    })
    .select("id")
    .single();

  if (claimErr) {
    if ((claimErr as { code?: string }).code === "23505") {
      // Another run already owns this reminder — do not send.
      return "deduped";
    }
    console.error("[email] failed to claim reminder slot", {
      contractId: r.contractId,
      type: r.reminderType,
      error: claimErr.message,
    });
    return "failed";
  }

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

    const { providerId } = await sendEmail(
      r.tenantId,
      {
        to: r.pmTenantEmail,
        subject,
        html,
        text,
        pmTenantId: r.pmTenantId,
        templateKey: r.reminderType,
      },
      { agency },
    );

    const { error } = await admin
      .from("rent_reminder_log")
      .update({ email_provider_id: providerId })
      .eq("id", claim.id);
    if (error) {
      console.error("[email] failed to record provider id", {
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
    // Downgrade the claimed row to "failed" so the audit trail is accurate. The
    // row is intentionally kept (not deleted) so the unique constraint stops us
    // re-trying the same reminder later today.
    const { error } = await admin
      .from("rent_reminder_log")
      .update({ status: "failed", error_message: errorMessage.slice(0, 500) })
      .eq("id", claim.id);
    if (error) {
      console.error("[email] failed to log failed reminder", error.message);
    }
    return "failed";
  }
}

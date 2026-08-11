// Scheduled-messages drain worker. Structurally a copy of
// src/lib/email/drain.ts: claim a batch (FOR UPDATE SKIP LOCKED — safe to run
// concurrently), then per row: quiet-hours re-check, per-tenant daily cap,
// recipient resolution, transport delivery, recurrence fan-out. Per-row
// failures are marked and swallowed so one bad row can't stall the queue.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Recurrence, ScheduledMessageRow } from "../domain/types";
import {
  addDaysISO,
  addMonthsISO,
  isWithinSendWindow,
  londonHour,
  londonStartOfDay,
  londonToday,
  londonWallTimeToUtc,
  nextWindowOpen,
} from "./london";
import {
  claimBatch,
  markCancelledBySystem,
  markFailed,
  markFailedPermanent,
  markSent,
  requeueAt,
} from "./queue";
import { recheckRuleMessage } from "./evaluate";
import {
  downgradeLegacyClaimOnFailure,
  recordLegacyClaimProviderId,
} from "./parity";
import { resolveRecipient } from "./recipients";
import { getTenantMessaging, type TenantMessaging } from "./settings";
import { deliverMessage, PermanentSendError } from "./transports";

export type MessageDrainResult = {
  claimed: number;
  sent: number;
  failed: number;
  deferred: number;
  cancelled: number;
};

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/** Count of today's (London day) outbound sends for a tenant. */
async function countSentToday(admin: Admin, tenantId: string): Promise<number> {
  const { count, error } = await admin
    .from("scheduled_messages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "sent")
    .neq("channel", "in_app")
    .gte("sent_at", londonStartOfDay().toISOString());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Blast-radius alert, at most once per tenant per London day. */
async function alertRateLimitOnce(admin: Admin, tenantId: string, limit: number): Promise<void> {
  const start = londonStartOfDay().toISOString();
  const { data, error } = await admin
    .from("error_events")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("source", "scheduled_messages_rate_limit")
    .gte("created_at", start)
    .limit(1);
  if (error) {
    console.error("[messages] rate-limit alert lookup failed", error.message);
    return;
  }
  if (data && data.length > 0) return;
  await admin.from("error_events").insert({
    tenant_id: tenantId,
    source: "scheduled_messages_rate_limit",
    message: `Daily message limit of ${limit} reached; further messages deferred to tomorrow`,
    context: {},
  });
}

/**
 * When a rule-generated message permanently fails, tell the rule's creator via
 * an in-app reminder (at most once per rule per London day) plus an
 * error_events row — self-dogfooding the queue for its own alerting.
 */
async function alertRuleFailureOnce(
  admin: Admin,
  row: ScheduledMessageRow,
  reason: string
): Promise<void> {
  if (!row.rule_id) return;
  try {
    const start = londonStartOfDay().toISOString();
    const { data: existing } = await admin
      .from("error_events")
      .select("id")
      .eq("tenant_id", row.tenant_id)
      .eq("source", "automation_rule_send_failure")
      .contains("context", { ruleId: row.rule_id })
      .gte("created_at", start)
      .limit(1);
    if (existing && existing.length > 0) return;

    await admin.from("error_events").insert({
      tenant_id: row.tenant_id,
      source: "automation_rule_send_failure",
      message: reason,
      context: { ruleId: row.rule_id, messageId: row.id },
    });

    const { data: rule } = await admin
      .from("automation_rules")
      .select("name, created_by")
      .eq("id", row.rule_id)
      .maybeSingle();
    if (!rule?.created_by) return;

    await admin.from("scheduled_messages").insert({
      tenant_id: row.tenant_id,
      channel: "in_app",
      recipient_kind: "staff",
      assignee_user_id: rule.created_by,
      subject: `Automation rule "${rule.name}" failed to send`,
      body: `A message from the rule "${rule.name}" could not be delivered: ${reason}. Check the rule's activity log and the Reminders → Failed tab.`,
      send_at: new Date().toISOString(),
      status: "queued",
    });
  } catch (err) {
    console.error("[messages] failed to raise rule-failure alert", {
      messageId: row.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Next occurrence of a recurring message, computed in London wall-clock terms
 * (same local hour after a DST switch) with month-length clamping.
 */
export function nextOccurrence(sendAt: Date, rec: Recurrence): Date {
  const day = londonToday(sendAt);
  const hour = londonHour(sendAt);
  const nextDay =
    rec.unit === "weeks" ? addDaysISO(day, rec.every * 7) : addMonthsISO(day, rec.every);
  return londonWallTimeToUtc(nextDay, hour);
}

/**
 * After a successful send, spawn the next instance of a recurring message.
 * Safe against duplication because only one worker ever holds the parent row
 * (the claim RPC guarantees single ownership).
 */
async function spawnRecurrenceSuccessor(admin: Admin, row: ScheduledMessageRow): Promise<void> {
  if (!row.recurrence) return;
  const next = nextOccurrence(new Date(row.send_at), row.recurrence);
  if (row.recurrence.until && londonToday(next) > row.recurrence.until) return;

  const { error } = await admin.from("scheduled_messages").insert({
    tenant_id: row.tenant_id,
    rule_id: row.rule_id,
    template_id: row.template_id,
    channel: row.channel,
    recipient_kind: row.recipient_kind,
    recipient_resolver: row.recipient_resolver,
    recipient_value: row.recipient_value,
    assignee_user_id: row.assignee_user_id,
    subject: row.subject,
    body: row.body,
    merge_context: row.merge_context,
    related_entity_type: row.related_entity_type,
    related_entity_id: row.related_entity_id,
    send_at: next.toISOString(),
    status: "queued",
    recurrence: row.recurrence,
    series_id: row.series_id ?? row.id,
    created_by: row.created_by,
  });
  if (error) {
    console.error("[messages] failed to spawn recurrence successor", {
      messageId: row.id,
      error: error.message,
    });
  }
}

export async function drainScheduledMessages(limit = 20): Promise<MessageDrainResult> {
  const batch = await claimBatch(limit);
  const admin = createSupabaseAdminClient();

  let sent = 0;
  let failed = 0;
  let deferred = 0;
  let cancelled = 0;

  // Per-run caches: many rows share a tenant.
  const tenantCache = new Map<string, TenantMessaging | null>();
  const sentTodayCache = new Map<string, number>();

  for (const row of batch) {
    try {
      let tenant = tenantCache.get(row.tenant_id);
      if (tenant === undefined) {
        tenant = await getTenantMessaging(admin, row.tenant_id);
        tenantCache.set(row.tenant_id, tenant);
      }
      if (!tenant) {
        await markFailedPermanent(row.id, "Agency not found for message");
        failed++;
        continue;
      }

      if (row.channel !== "in_app") {
        // Quiet hours: enforced again here (not just at enqueue) so snoozes,
        // edits, and settings changes after queueing still can't send at night.
        if (!isWithinSendWindow(tenant.settings)) {
          await requeueAt(
            row.id,
            nextWindowOpen(tenant.settings),
            "Deferred: outside send window"
          );
          deferred++;
          continue;
        }

        // Daily blast-radius cap.
        let sentToday = sentTodayCache.get(row.tenant_id);
        if (sentToday === undefined) {
          sentToday = await countSentToday(admin, row.tenant_id);
          sentTodayCache.set(row.tenant_id, sentToday);
        }
        if (sentToday >= tenant.settings.dailyLimit) {
          await requeueAt(
            row.id,
            londonWallTimeToUtc(addDaysISO(londonToday(), 1), tenant.settings.windowStart),
            "Deferred: daily message limit reached"
          );
          await alertRateLimitOnce(admin, row.tenant_id, tenant.settings.dailyLimit);
          deferred++;
          continue;
        }
      }

      // Rule-generated messages: re-check cheap conditions right before send
      // (a payment recorded between the sweep and the send hour cancels the
      // arrears chase instead of sending a wrong email).
      if (row.rule_id) {
        const recheck = await recheckRuleMessage(admin, row);
        if (!recheck.send) {
          await markCancelledBySystem(row.id, recheck.reason ?? "Condition cleared before send");
          cancelled++;
          continue;
        }
      }

      const recipient = await resolveRecipient(admin, row);
      if (!recipient.ok) {
        if (recipient.permanent) {
          await markFailedPermanent(row.id, recipient.reason);
          await alertRuleFailureOnce(admin, row, recipient.reason);
        } else {
          await markFailed(row.id, recipient.reason);
        }
        failed++;
        continue;
      }

      const outcome = await deliverMessage(row, recipient.address, recipient.pmTenantId);
      await markSent(row.id, outcome.sentTo);
      if (row.rule_id) {
        await recordLegacyClaimProviderId(admin, row, outcome.providerId);
      }
      sent++;
      if (row.channel !== "in_app") {
        sentTodayCache.set(row.tenant_id, (sentTodayCache.get(row.tenant_id) ?? 0) + 1);
      }

      await spawnRecurrenceSuccessor(admin, row);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        if (err instanceof PermanentSendError) {
          await markFailedPermanent(row.id, message);
          await alertRuleFailureOnce(admin, row, message);
        } else {
          await markFailed(row.id, message);
        }
        // If a rent-preset shim claim was written for this attempt, mirror the
        // legacy cron's downgrade so the audit trail stays accurate.
        await downgradeLegacyClaimOnFailure(admin, row, message);
      } catch (markErr) {
        console.error("[messages] failed to mark row failed", {
          messageId: row.id,
          error: markErr instanceof Error ? markErr.message : String(markErr),
        });
      }
      failed++;
    }
  }

  return { claimed: batch.length, sent, failed, deferred, cancelled };
}

export { markCancelledBySystem };

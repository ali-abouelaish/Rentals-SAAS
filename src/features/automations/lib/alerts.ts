// Agency-facing alerts for automation failures. One entry point for every way
// the engine can silently not do its job — a message that dead-letters, a rule
// the sweep can't evaluate, a message the sweep can't queue, the daily cap
// deferring sends — so the agency hears about it instead of only error_events
// (super-admin only) or the server log.
//
// Two channels, deliberately independent of the thing that failed:
//  - in-app: written straight into scheduled_messages as an already-"sent"
//    in_app row, NOT queued — a broken drain would otherwise swallow its own
//    alert.
//  - email: sendAgencyEmail (always the central Resend mailer), so a dead
//    agency mailbox can't swallow it either.
// Deduped to once per (tenant, kind, rule) per London day via error_events.
// Best-effort: never throws.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadAgency } from "@/lib/email/agency-context";
import { sendAgencyEmail } from "@/lib/email/agency-send";
import { getTenantAppUrl } from "@/lib/email/app-url";
import { londonStartOfDay } from "./london";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type AutomationAlertKind =
  /** A message failed and retrying can't fix it (opt-out, no address…). */
  | "send_failed"
  /** A message hit a temporary error on every one of its 5 attempts. */
  | "retries_exhausted"
  /** The sweep matched a rule but couldn't queue its message. */
  | "enqueue_failed"
  /** A rule couldn't be evaluated at all (bad config, missing template, crash). */
  | "rule_error"
  /** The agency's daily send cap was hit; remaining sends pushed to tomorrow. */
  | "daily_limit";

/**
 * error_events.source per kind. The first and last keep the names the engine
 * already wrote before this module existed so history stays continuous.
 */
const SOURCES: Record<AutomationAlertKind, string> = {
  send_failed: "automation_rule_send_failure",
  retries_exhausted: "automation_retries_exhausted",
  enqueue_failed: "automation_enqueue_failure",
  rule_error: "automation_rule_error",
  daily_limit: "scheduled_messages_rate_limit",
};

export type AutomationAlert = {
  tenantId: string;
  kind: AutomationAlertKind;
  reason: string;
  ruleId?: string | null;
  messageId?: string | null;
};

type RuleInfo = { name: string; created_by: string | null };

function headline(kind: AutomationAlertKind, rule: RuleInfo | null): string {
  const what = rule ? `Automation rule "${rule.name}"` : "A scheduled reminder";
  switch (kind) {
    case "send_failed":
      return `${what} failed to send`;
    case "retries_exhausted":
      return `${what} failed to send after 5 attempts`;
    case "enqueue_failed":
      return `${what} could not queue a message`;
    case "rule_error":
      return `${what} could not run`;
    case "daily_limit":
      return "Daily message limit reached — sends deferred to tomorrow";
  }
}

function advice(kind: AutomationAlertKind): string {
  switch (kind) {
    case "send_failed":
    case "retries_exhausted":
      return "Check the Reminders → Failed tab for the affected message; it will not be retried automatically.";
    case "enqueue_failed":
    case "rule_error":
      return "Open the rule and check its template, recipient and activity log. Messages from this rule were not sent today.";
    case "daily_limit":
      return "Remaining messages will go out when tomorrow's send window opens. Raise the daily limit in automation settings if this volume is expected.";
  }
}

async function alreadyAlertedToday(admin: Admin, alert: AutomationAlert): Promise<boolean> {
  let query = admin
    .from("error_events")
    .select("id")
    .eq("tenant_id", alert.tenantId)
    .eq("source", SOURCES[alert.kind])
    .gte("created_at", londonStartOfDay().toISOString())
    .limit(1);
  if (alert.ruleId) query = query.contains("context", { ruleId: alert.ruleId });
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

/** Active agency admins, oldest first. */
async function activeAdminIds(admin: Admin, tenantId: string): Promise<string[]> {
  const { data } = await admin
    .from("user_profiles")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .in("role", ["admin", "super_admin"])
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => r.id as string);
}

async function isActiveUser(admin: Admin, tenantId: string, userId: string): Promise<boolean> {
  const { data } = await admin
    .from("user_profiles")
    .select("id")
    .eq("id", userId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();
  return !!data;
}

/**
 * Email recipients: the agency contact inbox plus the rule's creator (if still
 * active). With no contact email, fall back to the first active admin so the
 * alert never has nowhere to go.
 */
async function resolveEmailRecipients(
  admin: Admin,
  tenantId: string,
  creatorId: string | null,
  adminIds: string[]
): Promise<string[]> {
  const out = new Set<string>();
  const { data: tenant } = await admin
    .from("tenants")
    .select("contact_email")
    .eq("id", tenantId)
    .maybeSingle();
  const contact = ((tenant?.contact_email as string | null) ?? "").trim();
  if (contact) out.add(contact.toLowerCase());

  const userIds = [creatorId, contact ? null : adminIds[0]].filter(Boolean) as string[];
  for (const id of userIds) {
    const { data } = await admin.auth.admin.getUserById(id);
    const email = data?.user?.email?.trim().toLowerCase();
    if (email) out.add(email);
  }
  return [...out];
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function notifyAutomationFailure(alert: AutomationAlert): Promise<void> {
  const admin = createSupabaseAdminClient();
  try {
    if (await alreadyAlertedToday(admin, alert)) return;

    await admin.from("error_events").insert({
      tenant_id: alert.tenantId,
      source: SOURCES[alert.kind],
      message: alert.reason.slice(0, 1000),
      context: { ruleId: alert.ruleId ?? null, messageId: alert.messageId ?? null },
    });

    let rule: RuleInfo | null = null;
    if (alert.ruleId) {
      const { data } = await admin
        .from("automation_rules")
        .select("name, created_by")
        .eq("id", alert.ruleId)
        .maybeSingle();
      if (data) rule = { name: data.name as string, created_by: (data.created_by as string) ?? null };
    }

    const adminIds = await activeAdminIds(admin, alert.tenantId);
    const creatorId =
      rule?.created_by && (await isActiveUser(admin, alert.tenantId, rule.created_by))
        ? rule.created_by
        : null;

    const subject = headline(alert.kind, rule);
    const tip = advice(alert.kind);
    const reason = alert.reason.slice(0, 300);
    const path =
      alert.ruleId && (alert.kind === "rule_error" || alert.kind === "enqueue_failed")
        ? `/automations/rules/${alert.ruleId}`
        : alert.kind === "daily_limit"
          ? "/reminders?tab=queued"
          : "/reminders?tab=failed";

    // In-app: inserted as already delivered so it shows in Reminders → Pending
    // even if the drain worker is the thing that's broken.
    // (staff rows require an assignee; with no active user, email alone.)
    const assignee = creatorId ?? adminIds[0] ?? null;
    if (assignee) {
      const now = new Date().toISOString();
      const { error: inAppErr } = await admin.from("scheduled_messages").insert({
        tenant_id: alert.tenantId,
        channel: "in_app",
        recipient_kind: "staff",
        assignee_user_id: assignee,
        subject,
        body: `${subject}: ${reason}. ${tip}`,
        send_at: now,
        sent_at: now,
        status: "sent",
      });
      if (inAppErr) {
        console.error("[automations] failed to write in-app alert", {
          tenantId: alert.tenantId,
          error: inAppErr.message,
        });
      }
    }

    const agency = await loadAgency(alert.tenantId);
    if (!agency) return;
    const recipients = await resolveEmailRecipients(admin, alert.tenantId, creatorId, adminIds);
    if (recipients.length === 0) {
      console.error("[automations] no email recipient for failure alert", {
        tenantId: alert.tenantId,
        kind: alert.kind,
      });
      return;
    }
    const url = await getTenantAppUrl(alert.tenantId, path);
    for (const to of recipients) {
      try {
        await sendAgencyEmail({
          agency,
          to,
          subject: `Action needed: ${subject}`,
          html: `<p>${escapeHtml(subject)} for ${escapeHtml(agency.name)}.</p>
<p>${escapeHtml(tip)}</p>
<p><a href="${url}">Review in Harbor Ops</a></p>
<p style="color:#64748b;font-size:12px">Reason: ${escapeHtml(reason)}</p>`,
          text: `${subject} for ${agency.name}.\n\n${tip}\n\nReview: ${url}\n\nReason: ${reason}`,
          templateKey: `automation_alert:${alert.kind}`,
          // The agency may have no contact_email; don't let that block the alert.
          replyTo: to,
        });
      } catch (err) {
        console.error("[automations] failed to email failure alert", {
          tenantId: alert.tenantId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    console.error("[automations] failed to raise failure alert", {
      tenantId: alert.tenantId,
      kind: alert.kind,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

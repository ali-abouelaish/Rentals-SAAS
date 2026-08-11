// Automation-rule evaluation. The daily sweep walks every active/dry-run
// rule, finds matching entities, claims each (rule, entity, occasion) in
// automation_runs FIRST (unique index; 23505 = someone else won, skip — the
// same claim-before-send discipline as rentReminders.processOne), then
// enqueues into scheduled_messages. Dry-run rules record would-sends and
// enqueue nothing.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DATE_FIELD_REGISTRY, type DateFieldCandidate } from "../domain/dateFields";
import {
  parseRuleRow,
  type AutomationRuleRow,
  type ThresholdMetric,
} from "../domain/rules";
import type { MessageEntityType, MessageTemplateRow, ScheduledMessageRow } from "../domain/types";
import { addDaysISO, londonToday, londonWallTimeToUtc } from "./london";
import { buildMergeContext } from "./mergeContext";
import { claimLegacyRentSlot } from "./parity";
import { enqueueScheduledMessage } from "./enqueue";
import { getTenantMessaging, type TenantMessaging } from "./settings";
import { renderTemplate } from "./render";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type SweepSummary = {
  ok: true;
  rules: number;
  candidates: number;
  fired: number;
  dryRuns: number;
  deduped: number;
  errors: number;
  durationMs: number;
};

const OPEN_JOB_STATUSES = ["open", "acknowledged", "in_progress", "pending_parts", "pending_quote"];

const ANCHOR_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatAnchor(iso: string): string {
  return ANCHOR_FMT.format(new Date(iso));
}

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/**
 * Monthly due periods for a contract from `start_date` up to today, capped at
 * 12 months back. Day-of-month is clamped to short months (the send-now
 * manual path's semantics — used for arrears metrics, NOT for the rent-due
 * date trigger, which replicates the stricter legacy cron matching).
 */
function duePeriods(
  startISO: string,
  collectionDay: number,
  todayISO: string
): { year: number; month: number; dueISO: string }[] {
  const start = new Date(startISO);
  const today = new Date(todayISO);
  const floor = new Date(today);
  floor.setUTCFullYear(floor.getUTCFullYear() - 1);
  const from = start > floor ? start : floor;

  const out: { year: number; month: number; dueISO: string }[] = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth();
  for (let i = 0; i < 14; i++) {
    const day = Math.min(collectionDay, daysInMonth(y, m));
    const due = new Date(Date.UTC(y, m, day));
    if (due > today) break;
    if (due >= start) {
      out.push({
        year: y,
        month: m + 1,
        dueISO: due.toISOString().slice(0, 10),
      });
    }
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
}

type ArrearsState = {
  contractId: string;
  tenantId: string;
  oldestUnpaidISO: string;
  daysOverdue: number;
  unpaidAmount: number;
  raw: Record<string, unknown>;
};

/** Per-contract arrears state for one tenant (unpaid periods in the last year). */
async function computeArrears(
  admin: Admin,
  tenantId: string,
  todayISO: string
): Promise<ArrearsState[]> {
  const { data: contracts, error } = await admin
    .from("property_contracts")
    .select("id, tenant_id, start_date, rent_pcm, collection_date, status")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .not("collection_date", "is", null);
  if (error) throw new Error(`arrears contracts: ${error.message}`);
  const rows = (contracts ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id as string);
  const { data: payments, error: payErr } = await admin
    .from("rent_payments")
    .select("contract_id, period_year, period_month")
    .in("contract_id", ids);
  if (payErr) throw new Error(`arrears payments: ${payErr.message}`);
  const paid = new Set(
    ((payments ?? []) as { contract_id: string; period_year: number; period_month: number }[]).map(
      (p) => `${p.contract_id}:${p.period_year}-${p.period_month}`
    )
  );

  const today = new Date(todayISO);
  const out: ArrearsState[] = [];
  for (const row of rows) {
    const periods = duePeriods(
      row.start_date as string,
      Number(row.collection_date),
      todayISO
    );
    const unpaid = periods.filter((p) => !paid.has(`${row.id}:${p.year}-${p.month}`));
    if (unpaid.length === 0) continue;
    const oldest = unpaid[0];
    const daysOverdue = Math.floor(
      (today.getTime() - new Date(oldest.dueISO).getTime()) / (24 * 60 * 60 * 1000)
    );
    if (daysOverdue <= 0) continue;
    out.push({
      contractId: row.id as string,
      tenantId: row.tenant_id as string,
      oldestUnpaidISO: oldest.dueISO,
      daysOverdue,
      unpaidAmount: unpaid.length * Number(row.rent_pcm ?? 0),
      raw: row,
    });
  }
  return out;
}

async function thresholdCandidates(
  admin: Admin,
  rule: AutomationRuleRow,
  metric: ThresholdMetric,
  gte: number,
  todayISO: string
): Promise<{ candidates: DateFieldCandidate[]; entityType: MessageEntityType }> {
  if (metric === "works_order_open_days") {
    const cutoff = addDaysISO(todayISO, -gte);
    const { data, error } = await admin
      .from("maintenance_jobs")
      .select("id, tenant_id, status, created_at")
      .eq("tenant_id", rule.tenant_id)
      .in("status", OPEN_JOB_STATUSES)
      .lte("created_at", `${cutoff}T23:59:59Z`);
    if (error) throw new Error(`works_order_open_days: ${error.message}`);
    return {
      entityType: "works_order",
      candidates: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        entityId: row.id as string,
        tenantId: row.tenant_id as string,
        anchorISO: (row.created_at as string).slice(0, 10),
        raw: row,
      })),
    };
  }

  const arrears = await computeArrears(admin, rule.tenant_id, todayISO);
  const matched = arrears.filter((a) =>
    metric === "arrears_days" ? a.daysOverdue >= gte : a.unpaidAmount >= gte
  );
  return {
    entityType: "tenancy",
    candidates: matched.map((a) => ({
      entityId: a.contractId,
      tenantId: a.tenantId,
      anchorISO: a.oldestUnpaidISO,
      raw: { ...a.raw, days_overdue: a.daysOverdue, unpaid_amount: a.unpaidAmount },
    })),
  };
}

/** Renter-eligibility filter for rules that email the renter directly. */
async function filterRenterEligibility(
  admin: Admin,
  rule: AutomationRuleRow,
  entityType: MessageEntityType,
  candidates: DateFieldCandidate[]
): Promise<DateFieldCandidate[]> {
  if (rule.recipient_config.kind !== "resolver") return candidates;
  if (rule.recipient_config.resolver !== "tenancy_renter") return candidates;
  if (entityType !== "tenancy" || candidates.length === 0) return candidates;
  // The rent_due_date registry entry already embeds this filter; re-checking is
  // cheap and covers the other tenancy date fields + arrears metrics.
  const ids = candidates.map((c) => c.entityId);
  const { data, error } = await admin
    .from("property_contracts")
    .select("id, pm_tenant:pm_tenants(email, email_status, reminders_enabled)")
    .in("id", ids);
  if (error) throw new Error(`renter eligibility: ${error.message}`);
  const eligible = new Set<string>();
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const pmRel = row.pm_tenant;
    const pm = (Array.isArray(pmRel) ? pmRel[0] : pmRel) as
      | { email: string | null; email_status: string; reminders_enabled: boolean }
      | null;
    if (pm && pm.reminders_enabled && pm.email_status === "active" && pm.email) {
      eligible.add(row.id as string);
    }
  }
  return candidates.filter((c) => eligible.has(c.entityId));
}

/** unpaid_period condition: drop candidates whose anchor month is already paid. */
async function filterUnpaidPeriod(
  admin: Admin,
  entityType: MessageEntityType,
  candidates: DateFieldCandidate[]
): Promise<DateFieldCandidate[]> {
  if (entityType !== "tenancy" || candidates.length === 0) return candidates;
  const ids = candidates.map((c) => c.entityId);
  const { data, error } = await admin
    .from("rent_payments")
    .select("contract_id, period_year, period_month")
    .in("contract_id", ids);
  if (error) throw new Error(`unpaid_period: ${error.message}`);
  const paid = new Set(
    ((data ?? []) as { contract_id: string; period_year: number; period_month: number }[]).map(
      (p) => `${p.contract_id}:${p.period_year}-${p.period_month}`
    )
  );
  return candidates.filter((c) => {
    const year = Number(c.anchorISO.slice(0, 4));
    const month = Number(c.anchorISO.slice(5, 7));
    return !paid.has(`${c.entityId}:${year}-${month}`);
  });
}

/** Repeat gating: fire only when the newest prior live run for the anchor is old enough. */
async function filterRepeatGate(
  admin: Admin,
  rule: AutomationRuleRow,
  candidates: DateFieldCandidate[],
  now: Date
): Promise<DateFieldCandidate[]> {
  if (!rule.repeat_config || candidates.length === 0) return candidates;
  const ids = candidates.map((c) => c.entityId);
  const { data, error } = await admin
    .from("automation_runs")
    .select("entity_id, dedupe_key, created_at")
    .eq("rule_id", rule.id)
    .eq("dry_run", false)
    .in("entity_id", ids);
  if (error) throw new Error(`repeat gate: ${error.message}`);
  const latest = new Map<string, number>();
  for (const run of (data ?? []) as { entity_id: string; dedupe_key: string; created_at: string }[]) {
    const anchor = run.dedupe_key.split(":r")[0];
    const key = `${run.entity_id}:${anchor}`;
    const t = new Date(run.created_at).getTime();
    if ((latest.get(key) ?? 0) < t) latest.set(key, t);
  }
  const minAgeMs = rule.repeat_config.every_days * 24 * 60 * 60 * 1000;
  return candidates.filter((c) => {
    const last = latest.get(`${c.entityId}:${c.anchorISO}`);
    return last === undefined || now.getTime() - last >= minAgeMs;
  });
}

async function loadTemplates(
  admin: Admin,
  templateIds: string[]
): Promise<Map<string, MessageTemplateRow>> {
  const map = new Map<string, MessageTemplateRow>();
  if (templateIds.length === 0) return map;
  const { data, error } = await admin
    .from("message_templates")
    .select("*")
    .in("id", [...new Set(templateIds)]);
  if (error) throw new Error(`templates: ${error.message}`);
  for (const t of (data ?? []) as MessageTemplateRow[]) map.set(t.id, t);
  return map;
}

export type FireOneResult = "fired" | "dry_run" | "deduped" | "error";

/**
 * Claim the run and (for live rules) enqueue the message. Exported for the
 * event-trigger path, which reuses the same claim + enqueue sequence.
 */
export async function fireRuleForEntity(opts: {
  admin: Admin;
  rule: AutomationRuleRow;
  template: MessageTemplateRow;
  entityType: MessageEntityType;
  entityId: string;
  anchorISO: string | null;
  dedupeKey: string;
  runDateISO: string;
  sendAt: Date;
  tenantCache?: Map<string, TenantMessaging | null>;
}): Promise<FireOneResult> {
  const { admin, rule, template } = opts;
  const isDry = rule.dry_run;

  const { data: run, error: runErr } = await admin
    .from("automation_runs")
    .insert({
      tenant_id: rule.tenant_id,
      rule_id: rule.id,
      entity_type: opts.entityType,
      entity_id: opts.entityId,
      anchor_date: opts.anchorISO,
      dedupe_key: opts.dedupeKey,
      run_date: opts.runDateISO,
      dry_run: isDry,
    })
    .select("id")
    .single();

  if (runErr) {
    if ((runErr as { code?: string }).code === "23505") return "deduped";
    console.error("[automations] failed to claim run", {
      ruleId: rule.id,
      entityId: opts.entityId,
      error: runErr.message,
    });
    return "error";
  }

  const extraContext = opts.anchorISO
    ? { anchor_date: formatAnchor(opts.anchorISO), anchor_date_iso: opts.anchorISO }
    : undefined;

  if (isDry) {
    // Record what WOULD have been sent, for the dry-run panel + parity diff.
    let detail: Record<string, unknown> = { wouldSendAt: opts.sendAt.toISOString() };
    try {
      let tenant = opts.tenantCache?.get(rule.tenant_id);
      if (tenant === undefined) {
        tenant = await getTenantMessaging(admin, rule.tenant_id);
        opts.tenantCache?.set(rule.tenant_id, tenant);
      }
      const built = await buildMergeContext(admin, {
        tenantId: rule.tenant_id,
        agencyName: tenant?.name ?? "",
        entityType: opts.entityType,
        entityId: opts.entityId,
      });
      if (built) {
        const ctx = { ...built.context, ...(extraContext ?? {}) };
        detail = {
          ...detail,
          entityLabel: built.entityLabel,
          subject: template.subject ? renderTemplate(template.subject, ctx).text : null,
          bodyPreview: renderTemplate(template.body, ctx).text.slice(0, 300),
        };
      }
    } catch (err) {
      detail.previewError = err instanceof Error ? err.message : String(err);
    }
    await admin.from("automation_runs").update({ detail }).eq("id", run.id);
    return "dry_run";
  }

  const enqueue = await enqueueScheduledMessage({
    tenantId: rule.tenant_id,
    channel: rule.channel,
    recipient: rule.recipient_config,
    subject: template.subject,
    body: template.body,
    templateId: template.id,
    ruleId: rule.id,
    relatedEntityType: opts.entityType,
    relatedEntityId: opts.entityId,
    sendAt: opts.sendAt,
    createdBy: rule.created_by,
    extraContext,
  });

  if (!enqueue.ok) {
    await admin
      .from("automation_runs")
      .update({ detail: { error: enqueue.error } })
      .eq("id", run.id);
    console.error("[automations] enqueue failed", {
      ruleId: rule.id,
      entityId: opts.entityId,
      error: enqueue.error,
    });
    return "error";
  }

  await admin
    .from("automation_runs")
    .update({
      scheduled_message_id: enqueue.id,
      detail: { sendAt: enqueue.sendAt.toISOString(), clamped: enqueue.clamped },
    })
    .eq("id", run.id);
  return "fired";
}

/**
 * Evaluate all active/dry-run rules (or one rule via opts.ruleId) for `now`.
 * Idempotent — safe to run twice; the runs table dedupes.
 */
export async function evaluateAutomationRules(
  now: Date = new Date(),
  opts?: { ruleId?: string }
): Promise<SweepSummary> {
  const startedAt = Date.now();
  const admin = createSupabaseAdminClient();
  const todayISO = londonToday(now);

  let query = admin
    .from("automation_rules")
    .select("*")
    .or("active.eq.true,dry_run.eq.true");
  if (opts?.ruleId) query = query.eq("id", opts.ruleId);
  const { data: rawRules, error } = await query;
  if (error) throw new Error(error.message);

  const rules: AutomationRuleRow[] = [];
  for (const raw of (rawRules ?? []) as Record<string, unknown>[]) {
    const parsed = parseRuleRow(raw);
    if (parsed) rules.push(parsed);
    else console.error("[automations] skipping rule with invalid config", { ruleId: raw.id });
  }

  const templates = await loadTemplates(admin, rules.map((r) => r.template_id));
  const tenantCache = new Map<string, TenantMessaging | null>();

  let candidatesTotal = 0;
  let fired = 0;
  let dryRuns = 0;
  let deduped = 0;
  let errors = 0;

  for (const rule of rules) {
    try {
      const template = templates.get(rule.template_id);
      if (!template) {
        console.error("[automations] rule template missing", { ruleId: rule.id });
        errors++;
        continue;
      }

      let entityType: MessageEntityType;
      let candidates: DateFieldCandidate[];

      if (rule.trigger_config.kind === "date_offset") {
        const entry = DATE_FIELD_REGISTRY[rule.trigger_config.field];
        if (!entry) {
          errors++;
          continue;
        }
        // "N days BEFORE the anchor" → today's sweep targets anchor = today+N.
        const anchorISO =
          rule.trigger_config.direction === "before"
            ? addDaysISO(todayISO, rule.trigger_config.offset_days)
            : addDaysISO(todayISO, -rule.trigger_config.offset_days);
        entityType = entry.entityType;
        candidates = await entry.fetchDue(admin, anchorISO, rule.tenant_id);
      } else if (rule.trigger_config.kind === "threshold") {
        const result = await thresholdCandidates(
          admin,
          rule,
          rule.trigger_config.metric,
          rule.trigger_config.gte,
          todayISO
        );
        entityType = result.entityType;
        candidates = result.candidates;
      } else {
        // Event rules fire on write via emitAutomationEvent, not the sweep.
        continue;
      }

      // Conditions.
      for (const condition of rule.conditions) {
        if (condition.type === "unpaid_period") {
          candidates = await filterUnpaidPeriod(admin, entityType, candidates);
        } else if (condition.type === "status_in") {
          candidates = candidates.filter((c) =>
            condition.values.includes(String(c.raw.status ?? ""))
          );
        }
      }

      candidates = await filterRenterEligibility(admin, rule, entityType, candidates);
      candidates = await filterRepeatGate(admin, rule, candidates, now);
      candidatesTotal += candidates.length;

      const sendAt = londonWallTimeToUtc(todayISO, rule.send_hour);
      for (const candidate of candidates) {
        const dedupeKey = rule.repeat_config
          ? `${candidate.anchorISO}:r${todayISO}`
          : candidate.anchorISO;
        const result = await fireRuleForEntity({
          admin,
          rule,
          template,
          entityType,
          entityId: candidate.entityId,
          anchorISO: candidate.anchorISO,
          dedupeKey,
          runDateISO: todayISO,
          sendAt,
          tenantCache,
        });
        if (result === "fired") fired++;
        else if (result === "dry_run") dryRuns++;
        else if (result === "deduped") deduped++;
        else errors++;
      }
    } catch (err) {
      errors++;
      console.error("[automations] rule evaluation failed", {
        ruleId: rule.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    ok: true,
    rules: rules.length,
    candidates: candidatesTotal,
    fired,
    dryRuns,
    deduped,
    errors,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Pre-send gate for rule-generated messages, run by the drain worker:
 * 1. Cheap condition re-check — between the 08:30 sweep and the send hour,
 *    state can change (payment recorded at 08:45, job closed).
 * 2. Rent-preset cutover shim — claim the legacy rent_reminder_log slot so
 *    the legacy cron and the new engine can never both email the same
 *    contract for the same period during the transition.
 * Returns send:false with a reason when the message should be cancelled.
 */
export async function recheckRuleMessage(
  admin: Admin,
  row: ScheduledMessageRow
): Promise<{ send: boolean; reason?: string }> {
  if (!row.rule_id) return { send: true };

  const { data: raw, error } = await admin
    .from("automation_rules")
    .select("*")
    .eq("id", row.rule_id)
    .maybeSingle();
  if (error || !raw) return { send: true };
  const rule = parseRuleRow(raw as Record<string, unknown>);
  if (!rule) return { send: true };

  const anchorISO = row.merge_context?.anchor_date_iso;

  const checksArrears =
    (rule.trigger_config.kind === "threshold" &&
      rule.trigger_config.metric !== "works_order_open_days") ||
    rule.conditions.some((c) => c.type === "unpaid_period");
  if (
    checksArrears &&
    row.related_entity_type === "tenancy" &&
    row.related_entity_id &&
    anchorISO
  ) {
    const { data: payment } = await admin
      .from("rent_payments")
      .select("id")
      .eq("contract_id", row.related_entity_id)
      .eq("period_year", Number(anchorISO.slice(0, 4)))
      .eq("period_month", Number(anchorISO.slice(5, 7)))
      .maybeSingle();
    if (payment) return { send: false, reason: "Condition cleared before send: rent paid" };
  }

  const checksOpenJob =
    rule.trigger_config.kind === "threshold" &&
    rule.trigger_config.metric === "works_order_open_days";
  if (checksOpenJob && row.related_entity_type === "works_order" && row.related_entity_id) {
    const { data: job } = await admin
      .from("maintenance_jobs")
      .select("status")
      .eq("id", row.related_entity_id)
      .maybeSingle();
    if (job && !OPEN_JOB_STATUSES.includes(job.status as string)) {
      return { send: false, reason: "Condition cleared before send: works order no longer open" };
    }
  }

  // Cutover shim: rent presets also claim the legacy rent_reminder_log slot.
  const shim = await claimLegacyRentSlot(admin, row, rule);
  if (!shim.proceed) {
    return { send: false, reason: shim.reason ?? "Legacy rent reminder already sent" };
  }

  return { send: true };
}

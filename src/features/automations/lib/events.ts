// App-level event triggers. Server actions call emitAutomationEvent after a
// successful write; matching event rules claim a run and enqueue immediately
// (send_at = now, window-clamped for email). The entire body is guarded so a
// hook can NEVER break its host action — automation failure logs and moves on.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseRuleRow } from "../domain/rules";
import type { MessageEntityType, MessageTemplateRow } from "../domain/types";
import { fireRuleForEntity } from "./evaluate";
import { londonToday } from "./london";

export type AutomationEventPayload =
  | { type: "works_order_status_changed"; jobId: string; toStatus: string }
  | { type: "payment_received"; contractId: string; periodYear: number; periodMonth: number }
  | { type: "tenancy_signed"; contractId: string };

function eventEntity(payload: AutomationEventPayload): {
  entityType: MessageEntityType;
  entityId: string;
  dedupeKey: string;
} {
  switch (payload.type) {
    case "works_order_status_changed":
      return {
        entityType: "works_order",
        entityId: payload.jobId,
        // Same transition twice on the same day fires once.
        dedupeKey: `wo_status:${payload.jobId}:${payload.toStatus}:${londonToday()}`,
      };
    case "payment_received":
      return {
        entityType: "tenancy",
        entityId: payload.contractId,
        dedupeKey: `payment:${payload.contractId}:${payload.periodYear}-${payload.periodMonth}`,
      };
    case "tenancy_signed":
      return {
        entityType: "tenancy",
        entityId: payload.contractId,
        dedupeKey: `signed:${payload.contractId}`,
      };
  }
}

export async function emitAutomationEvent(
  tenantId: string,
  payload: AutomationEventPayload
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();

    const { data: rawRules, error } = await admin
      .from("automation_rules")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("trigger_type", "event")
      .or("active.eq.true,dry_run.eq.true");
    if (error) throw new Error(error.message);
    if (!rawRules || rawRules.length === 0) return;

    const matching = [];
    for (const raw of rawRules as Record<string, unknown>[]) {
      const rule = parseRuleRow(raw);
      if (!rule || rule.trigger_config.kind !== "event") continue;
      if (rule.trigger_config.event !== payload.type) continue;
      if (
        payload.type === "works_order_status_changed" &&
        rule.trigger_config.to_status &&
        rule.trigger_config.to_status !== payload.toStatus
      ) {
        continue;
      }
      matching.push(rule);
    }
    if (matching.length === 0) return;

    const { entityType, entityId, dedupeKey } = eventEntity(payload);
    const todayISO = londonToday();

    for (const rule of matching) {
      const { data: template } = await admin
        .from("message_templates")
        .select("*")
        .eq("id", rule.template_id)
        .maybeSingle();
      if (!template) continue;

      await fireRuleForEntity({
        admin,
        rule,
        template: template as MessageTemplateRow,
        entityType,
        entityId,
        anchorISO: todayISO,
        dedupeKey,
        runDateISO: todayISO,
        sendAt: new Date(),
      });
    }
  } catch (err) {
    console.error("[automations] emitAutomationEvent failed", {
      tenantId,
      event: payload.type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

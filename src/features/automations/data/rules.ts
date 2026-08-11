// Rule reads for the automations pages.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  parseRuleRow,
  type AutomationRuleRow,
  type AutomationRunRow,
} from "../domain/rules";
import type { ScheduledMessageRow } from "../domain/types";

export type RuleListItem = AutomationRuleRow & { template_name: string | null };

export async function listRules(tenantId: string): Promise<RuleListItem[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("automation_rules")
    .select("*, template:message_templates(name)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const out: RuleListItem[] = [];
  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    const parsed = parseRuleRow(raw);
    if (!parsed) continue;
    const tplRel = raw.template;
    const tpl = (Array.isArray(tplRel) ? tplRel[0] : tplRel) as { name: string } | null;
    out.push({ ...parsed, template_name: tpl?.name ?? null });
  }
  return out;
}

export async function getRule(
  tenantId: string,
  ruleId: string
): Promise<AutomationRuleRow | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("automation_rules")
    .select("*")
    .eq("id", ruleId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return parseRuleRow(data as Record<string, unknown>);
}

export type RuleActivityEntry = AutomationRunRow & {
  message_status: ScheduledMessageRow["status"] | null;
  message_sent_to: string | null;
};

export async function getRuleActivity(
  tenantId: string,
  ruleId: string,
  limit = 50
): Promise<RuleActivityEntry[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("automation_runs")
    .select("*")
    .eq("rule_id", ruleId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const runs = (data ?? []) as AutomationRunRow[];

  const messageIds = runs
    .map((r) => r.scheduled_message_id)
    .filter(Boolean) as string[];
  const messages = new Map<string, { status: ScheduledMessageRow["status"]; sent_to: string | null }>();
  if (messageIds.length > 0) {
    const { data: msgs, error: msgErr } = await admin
      .from("scheduled_messages")
      .select("id, status, sent_to")
      .in("id", messageIds);
    if (msgErr) throw new Error(msgErr.message);
    for (const m of (msgs ?? []) as { id: string; status: ScheduledMessageRow["status"]; sent_to: string | null }[]) {
      messages.set(m.id, { status: m.status, sent_to: m.sent_to });
    }
  }

  return runs.map((r) => {
    const m = r.scheduled_message_id ? messages.get(r.scheduled_message_id) : undefined;
    return {
      ...r,
      message_status: m?.status ?? null,
      message_sent_to: m?.sent_to ?? null,
    };
  });
}

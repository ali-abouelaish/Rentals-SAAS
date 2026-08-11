import { z } from "zod";
import { DATE_FIELD_KEYS, DATE_FIELD_REGISTRY } from "./dateFields";
import {
  recipientConfigSchema,
  type MessageChannel,
  type RecipientConfig,
} from "./types";

export const AUTOMATION_EVENTS = [
  "works_order_status_changed",
  "payment_received",
  "tenancy_signed",
] as const;
export type AutomationEvent = (typeof AUTOMATION_EVENTS)[number];

export const THRESHOLD_METRICS = [
  "arrears_days",
  "arrears_amount",
  "works_order_open_days",
] as const;
export type ThresholdMetric = (typeof THRESHOLD_METRICS)[number];

export const triggerConfigSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("date_offset"),
    field: z.string().refine((f) => DATE_FIELD_KEYS.includes(f), "Unknown date field"),
    offset_days: z.number().int().min(0).max(365),
    direction: z.enum(["before", "after"]),
  }),
  z.object({
    kind: z.literal("event"),
    event: z.enum(AUTOMATION_EVENTS),
    /** For works_order_status_changed: only fire when it lands on this status. */
    to_status: z.string().optional(),
  }),
  z.object({
    kind: z.literal("threshold"),
    metric: z.enum(THRESHOLD_METRICS),
    /** Days for *_days metrics, whole pounds for arrears_amount. */
    gte: z.number().min(1).max(100000),
  }),
]);
export type TriggerConfig = z.infer<typeof triggerConfigSchema>;

export const conditionSchema = z.discriminatedUnion("type", [
  /** Tenancy rules: only fire if the anchor month's rent has no payment row. */
  z.object({ type: z.literal("unpaid_period") }),
  /** Only fire while the entity's status is one of these. */
  z.object({ type: z.literal("status_in"), values: z.array(z.string()).min(1) }),
]);
export type RuleCondition = z.infer<typeof conditionSchema>;
export const conditionsSchema = z.array(conditionSchema);

export const repeatConfigSchema = z.object({
  every_days: z.number().int().min(1).max(90),
  until_cleared: z.literal(true),
});
export type RepeatConfig = z.infer<typeof repeatConfigSchema>;

export type RuleMode = "off" | "dry_run" | "live";

export type AutomationRuleRow = {
  id: string;
  tenant_id: string;
  name: string;
  preset_key: string | null;
  trigger_type: "date_offset" | "event" | "threshold";
  trigger_config: TriggerConfig;
  conditions: RuleCondition[];
  repeat_config: RepeatConfig | null;
  channel: MessageChannel;
  template_id: string;
  recipient_config: RecipientConfig;
  send_hour: number;
  active: boolean;
  dry_run: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationRunRow = {
  id: string;
  tenant_id: string;
  rule_id: string;
  entity_type: string;
  entity_id: string;
  anchor_date: string | null;
  dedupe_key: string;
  run_date: string;
  dry_run: boolean;
  scheduled_message_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export function ruleMode(rule: Pick<AutomationRuleRow, "active" | "dry_run">): RuleMode {
  if (rule.active && !rule.dry_run) return "live";
  if (rule.dry_run) return "dry_run";
  return "off";
}

/** Parse the JSON columns of a raw automation_rules row; null when invalid. */
export function parseRuleRow(row: Record<string, unknown>): AutomationRuleRow | null {
  const trigger = triggerConfigSchema.safeParse(row.trigger_config);
  const conditions = conditionsSchema.safeParse(row.conditions ?? []);
  const recipient = recipientConfigSchema.safeParse(row.recipient_config);
  const repeat =
    row.repeat_config == null
      ? { success: true as const, data: null }
      : repeatConfigSchema.safeParse(row.repeat_config);
  if (!trigger.success || !conditions.success || !recipient.success || !repeat.success) {
    return null;
  }
  return {
    ...(row as unknown as AutomationRuleRow),
    trigger_config: trigger.data,
    conditions: conditions.data,
    recipient_config: recipient.data,
    repeat_config: repeat.success ? (repeat.data as RepeatConfig | null) : null,
  };
}

const EVENT_LABELS: Record<AutomationEvent, string> = {
  works_order_status_changed: "a works order changes status",
  payment_received: "a rent payment is recorded",
  tenancy_signed: "a tenancy is signed",
};

/** Human one-liner for a rule's trigger, for lists and the activity header. */
export function describeTrigger(t: TriggerConfig): string {
  if (t.kind === "date_offset") {
    const label = DATE_FIELD_REGISTRY[t.field]?.label ?? t.field;
    if (t.offset_days === 0) return `On the day — ${label}`;
    return `${t.offset_days} day${t.offset_days === 1 ? "" : "s"} ${t.direction} — ${label}`;
  }
  if (t.kind === "threshold") {
    if (t.metric === "arrears_days") return `Rent overdue for ${t.gte}+ days`;
    if (t.metric === "arrears_amount") return `Arrears of £${t.gte}+`;
    return `Works order open for ${t.gte}+ days`;
  }
  return `When ${EVENT_LABELS[t.event]}${t.to_status ? ` (→ ${t.to_status.replace(/_/g, " ")})` : ""}`;
}

export const ruleInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Max 120 characters"),
  triggerConfig: triggerConfigSchema,
  conditions: conditionsSchema.default([]),
  repeatConfig: repeatConfigSchema.nullable().default(null),
  channel: z.enum(["email", "in_app"]),
  templateId: z.string().uuid("Choose a template"),
  recipientConfig: recipientConfigSchema,
  sendHour: z.number().int().min(0).max(23).default(9),
});
export type RuleInput = z.infer<typeof ruleInputSchema>;

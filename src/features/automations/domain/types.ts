import { z } from "zod";

export const MESSAGE_CHANNELS = ["email", "sms", "in_app"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const MESSAGE_STATUSES = [
  "queued",
  "sending",
  "sent",
  "failed",
  "cancelled",
  "snoozed",
  "dismissed",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const RECIPIENT_RESOLVERS = [
  "tenancy_renter",
  "property_owner",
  "works_order_contractor",
  "certificate_issuer",
] as const;
export type RecipientResolver = (typeof RECIPIENT_RESOLVERS)[number];

export const MESSAGE_ENTITY_TYPES = [
  "property",
  "unit",
  "tenancy",
  "pm_tenant",
  "works_order",
  "owner",
  "certificate",
] as const;
export type MessageEntityType = (typeof MESSAGE_ENTITY_TYPES)[number];

/** Templates additionally allow "none" for entity-agnostic messages. */
export const TEMPLATE_ENTITY_TYPES = [...MESSAGE_ENTITY_TYPES, "none"] as const;
export type TemplateEntityType = (typeof TEMPLATE_ENTITY_TYPES)[number];

export const recurrenceSchema = z.object({
  every: z.number().int().min(1).max(52),
  unit: z.enum(["weeks", "months"]),
  /** YYYY-MM-DD; recurrence stops once the next occurrence would pass this. */
  until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullable()
    .optional(),
});
export type Recurrence = z.infer<typeof recurrenceSchema>;

/**
 * Who a message goes to. `resolver` looks the address up from the related
 * entity at dispatch time (fresh data, honours opt-outs); `literal` is a raw
 * email/mobile; `staff` targets an internal user (in_app channel only).
 */
export const recipientConfigSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("resolver"),
    resolver: z.enum(RECIPIENT_RESOLVERS),
  }),
  z.object({
    kind: z.literal("literal"),
    address: z.string().trim().min(3).max(320),
  }),
  z.object({
    kind: z.literal("staff"),
    userId: z.string().uuid(),
  }),
]);
export type RecipientConfig = z.infer<typeof recipientConfigSchema>;

export type ScheduledMessageRow = {
  id: string;
  tenant_id: string;
  rule_id: string | null;
  template_id: string | null;
  channel: MessageChannel;
  recipient_kind: RecipientConfig["kind"];
  recipient_resolver: RecipientResolver | null;
  recipient_value: string | null;
  assignee_user_id: string | null;
  subject: string | null;
  body: string;
  merge_context: Record<string, string>;
  related_entity_type: MessageEntityType | null;
  related_entity_id: string | null;
  send_at: string;
  status: MessageStatus;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  sent_to: string | null;
  acknowledged_at: string | null;
  recurrence: Recurrence | null;
  series_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageTemplateRow = {
  id: string;
  tenant_id: string;
  key: string;
  name: string;
  channel: MessageChannel;
  entity_type: TemplateEntityType;
  subject: string | null;
  body: string;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Per-agency send window (Europe/London hours) + daily blast-radius cap. */
export type MessagingSettings = {
  windowStart: number;
  windowEnd: number;
  dailyLimit: number;
};

export const messagingSettingsSchema = z
  .object({
    windowStart: z.number().int().min(0).max(23),
    windowEnd: z.number().int().min(1).max(24),
    dailyLimit: z.number().int().min(1).max(10000),
  })
  .refine((s) => s.windowStart < s.windowEnd, {
    message: "Window start must be before window end",
    path: ["windowEnd"],
  });

// The single entry point for putting a message on the scheduled_messages
// queue. Used by ad-hoc reminder actions, the automation-rule sweep, and event
// hooks — nothing else inserts into the table. Renders subject/body from merge
// context here (snapshot semantics) and clamps send_at into the agency's send
// window for outbound channels.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  MessageChannel,
  MessageEntityType,
  RecipientConfig,
  Recurrence,
} from "../domain/types";
import { buildMergeContext, sharedContext } from "./mergeContext";
import { clampToSendWindow } from "./london";
import { renderTemplate } from "./render";
import { getTenantMessaging } from "./settings";

export type EnqueueParams = {
  tenantId: string;
  channel: MessageChannel;
  recipient: RecipientConfig;
  /** May contain {{merge_fields}}; rendered before insert. */
  subject?: string | null;
  /** May contain {{merge_fields}}; rendered before insert. */
  body: string;
  templateId?: string | null;
  ruleId?: string | null;
  relatedEntityType?: MessageEntityType | null;
  relatedEntityId?: string | null;
  sendAt: Date;
  recurrence?: Recurrence | null;
  seriesId?: string | null;
  createdBy?: string | null;
  /** Extra merge keys layered over the entity context (e.g. rule anchor_date). */
  extraContext?: Record<string, string>;
};

export type EnqueueResult =
  | {
      ok: true;
      id: string;
      sendAt: Date;
      /** True when send_at was moved into the agency's send window. */
      clamped: boolean;
      /** {{keys}} in the template with no value in the merge context. */
      unknownKeys: string[];
    }
  | { ok: false; error: string };

export async function enqueueScheduledMessage(params: EnqueueParams): Promise<EnqueueResult> {
  const admin = createSupabaseAdminClient();

  // Structural recipient/channel invariants (the DB CHECKs mirror these).
  if (params.channel === "in_app" && params.recipient.kind !== "staff") {
    return { ok: false, error: "In-app reminders must be assigned to a staff member." };
  }
  if (params.channel !== "in_app" && params.recipient.kind === "staff") {
    return { ok: false, error: "Staff recipients only support the in-app channel." };
  }
  if (
    params.recipient.kind === "resolver" &&
    (!params.relatedEntityType || !params.relatedEntityId)
  ) {
    return { ok: false, error: "This recipient type needs a linked record to resolve from." };
  }

  const tenant = await getTenantMessaging(admin, params.tenantId);
  if (!tenant) return { ok: false, error: "Agency not found." };

  // Merge context: entity-specific when linked, shared-only otherwise.
  let context = sharedContext(tenant.name);
  if (params.relatedEntityType && params.relatedEntityId) {
    const built = await buildMergeContext(admin, {
      tenantId: params.tenantId,
      agencyName: tenant.name,
      entityType: params.relatedEntityType,
      entityId: params.relatedEntityId,
    });
    if (!built) return { ok: false, error: "Linked record not found." };
    context = built.context;
  }
  if (params.extraContext) {
    context = { ...context, ...params.extraContext };
  }

  const renderedBody = renderTemplate(params.body, context);
  const renderedSubject = params.subject ? renderTemplate(params.subject, context) : null;
  const unknownKeys = [
    ...new Set([...renderedBody.unknownKeys, ...(renderedSubject?.unknownKeys ?? [])]),
  ];

  // Quiet hours: never queue an outbound message for outside the send window.
  let sendAt = params.sendAt;
  let clamped = false;
  if (params.channel !== "in_app") {
    const result = clampToSendWindow(tenant.settings, sendAt);
    sendAt = result.sendAt;
    clamped = result.clamped;
  }

  const { data, error } = await admin
    .from("scheduled_messages")
    .insert({
      tenant_id: params.tenantId,
      rule_id: params.ruleId ?? null,
      template_id: params.templateId ?? null,
      channel: params.channel,
      recipient_kind: params.recipient.kind,
      recipient_resolver:
        params.recipient.kind === "resolver" ? params.recipient.resolver : null,
      recipient_value: params.recipient.kind === "literal" ? params.recipient.address : null,
      assignee_user_id: params.recipient.kind === "staff" ? params.recipient.userId : null,
      subject: renderedSubject?.text ?? null,
      body: renderedBody.text,
      merge_context: context,
      related_entity_type: params.relatedEntityType ?? null,
      related_entity_id: params.relatedEntityId ?? null,
      send_at: sendAt.toISOString(),
      status: "queued",
      recurrence: params.recurrence ?? null,
      series_id: params.seriesId ?? null,
      created_by: params.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  if (!data?.id) return { ok: false, error: "Insert did not return an id." };

  return { ok: true, id: data.id as string, sendAt, clamped, unknownKeys };
}

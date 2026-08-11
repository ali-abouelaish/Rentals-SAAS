"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import {
  MESSAGE_ENTITY_TYPES,
  recipientConfigSchema,
  recurrenceSchema,
} from "../domain/types";
import { enqueueScheduledMessage } from "../lib/enqueue";

const createReminderInput = z
  .object({
    channel: z.enum(["email", "sms", "in_app"]),
    recipient: recipientConfigSchema,
    subject: z.string().trim().max(200).nullable().optional(),
    body: z.string().trim().min(1, "Message body is required").max(5000),
    relatedEntityType: z.enum(MESSAGE_ENTITY_TYPES).nullable().optional(),
    relatedEntityId: z.string().uuid().nullable().optional(),
    sendAtISO: z.string().min(1, "Send time is required"),
    recurrence: recurrenceSchema.nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.channel === "email" && !val.subject?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subject"],
        message: "Email reminders need a subject",
      });
    }
    if (
      val.channel === "email" &&
      val.recipient.kind === "literal" &&
      !z.string().email().safeParse(val.recipient.address).success
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recipient"],
        message: "Enter a valid email address",
      });
    }
  });

export type CreateReminderInput = z.infer<typeof createReminderInput>;

export type CreateReminderResult =
  | { ok: true; id: string; sendAtISO: string; clamped: boolean }
  | { ok: false; error: string };

export async function createAdHocReminder(
  input: CreateReminderInput
): Promise<CreateReminderResult> {
  const profile = await requireRole([...ADMIN_ROLES]);

  const parsed = createReminderInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid reminder." };
  }
  const data = parsed.data;

  if (data.channel === "sms") {
    return { ok: false, error: "SMS sending is not configured yet." };
  }

  const sendAt = new Date(data.sendAtISO);
  if (Number.isNaN(sendAt.getTime())) {
    return { ok: false, error: "Invalid send time." };
  }

  const result = await enqueueScheduledMessage({
    tenantId: profile.tenant_id,
    channel: data.channel,
    recipient: data.recipient,
    subject: data.subject ?? null,
    body: data.body,
    relatedEntityType: data.relatedEntityType ?? null,
    relatedEntityId: data.relatedEntityId ?? null,
    sendAt,
    recurrence: data.recurrence ?? null,
    createdBy: profile.id,
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/reminders");
  return {
    ok: true,
    id: result.id,
    sendAtISO: result.sendAt.toISOString(),
    clamped: result.clamped,
  };
}

type MutateResult = { ok: true } | { ok: false; error: string };

/**
 * Conditional-status update: returns the number of rows actually moved. A zero
 * count means the worker (or another user) got there first — callers surface
 * that instead of clobbering an in-flight send.
 */
async function guardedTransition(
  tenantId: string,
  id: string,
  fromStatuses: string[],
  patch: Record<string, unknown>,
  opts?: { channel?: "email" | "sms" | "in_app" }
): Promise<number> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("scheduled_messages")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .in("status", fromStatuses);
  if (opts?.channel) query = query.eq("channel", opts.channel);
  const { data, error } = await query.select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function cancelMessage(id: string): Promise<MutateResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const moved = await guardedTransition(profile.tenant_id, id, ["queued", "snoozed"], {
    status: "cancelled",
  });
  if (moved === 0) {
    return { ok: false, error: "Message is already being sent or was already handled." };
  }
  revalidatePath("/reminders");
  return { ok: true };
}

const updateQueuedInput = z.object({
  id: z.string().uuid(),
  subject: z.string().trim().max(200).nullable().optional(),
  body: z.string().trim().min(1, "Message body is required").max(5000),
  sendAtISO: z.string().min(1),
});

export type UpdateQueuedInput = z.infer<typeof updateQueuedInput>;

export async function updateQueuedMessage(input: UpdateQueuedInput): Promise<MutateResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const parsed = updateQueuedInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid message." };
  }
  const sendAt = new Date(parsed.data.sendAtISO);
  if (Number.isNaN(sendAt.getTime())) return { ok: false, error: "Invalid send time." };

  const moved = await guardedTransition(
    profile.tenant_id,
    parsed.data.id,
    ["queued", "snoozed"],
    {
      subject: parsed.data.subject ?? null,
      body: parsed.data.body,
      send_at: sendAt.toISOString(),
      status: "queued",
    }
  );
  if (moved === 0) {
    return { ok: false, error: "Message is already being sent or was already handled." };
  }
  revalidatePath("/reminders");
  return { ok: true };
}

/** In-app only: push a pending reminder away until `untilISO`. */
export async function snoozeMessage(id: string, untilISO: string): Promise<MutateResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const until = new Date(untilISO);
  if (Number.isNaN(until.getTime())) return { ok: false, error: "Invalid snooze time." };

  const moved = await guardedTransition(
    profile.tenant_id,
    id,
    ["sent", "queued", "snoozed"],
    { status: "snoozed", send_at: until.toISOString(), acknowledged_at: null },
    { channel: "in_app" }
  );
  if (moved === 0) return { ok: false, error: "Reminder can no longer be snoozed." };
  revalidatePath("/reminders");
  return { ok: true };
}

/** In-app only: mark a pending reminder as done (kept in history). */
export async function acknowledgeMessage(id: string): Promise<MutateResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const moved = await guardedTransition(
    profile.tenant_id,
    id,
    ["sent"],
    { acknowledged_at: new Date().toISOString() },
    { channel: "in_app" }
  );
  if (moved === 0) return { ok: false, error: "Reminder is not pending." };
  revalidatePath("/reminders");
  return { ok: true };
}

/** In-app only: remove a reminder from the inbox permanently. */
export async function dismissMessage(id: string): Promise<MutateResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const moved = await guardedTransition(
    profile.tenant_id,
    id,
    ["sent", "queued", "snoozed"],
    { status: "dismissed" },
    { channel: "in_app" }
  );
  if (moved === 0) return { ok: false, error: "Reminder was already handled." };
  revalidatePath("/reminders");
  return { ok: true };
}

export type StaffOption = { id: string; name: string };

/** Staff users of this agency, for the in-app reminder assignee picker. */
export async function listStaffForAssignment(): Promise<StaffOption[]> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("user_profiles")
    .select("id, display_name, role")
    .eq("tenant_id", profile.tenant_id)
    .order("display_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((u) => ({
    id: u.id as string,
    name:
      (u.display_name as string | null) ||
      `Unnamed ${((u.role as string | null) ?? "user").replace(/_/g, " ")}`,
  }));
}

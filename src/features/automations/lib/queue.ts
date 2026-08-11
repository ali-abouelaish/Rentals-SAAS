// Thin wrappers over the scheduled_messages queue RPCs and status writes.
// Mirrors src/lib/email/outbox.ts. All writes use the service-role admin
// client — the table has select-only RLS.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ScheduledMessageRow } from "../domain/types";

/**
 * Atomically claim up to `limit` due rows (queued/snoozed, send_at <= now,
 * attempts < 5), marking them as sending. FOR UPDATE SKIP LOCKED in the DB, so
 * concurrent drains (scheduler + HTTP trigger, or PM2 cluster) never
 * double-claim a row.
 */
export async function claimBatch(limit = 20): Promise<ScheduledMessageRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_scheduled_messages_batch", { lim: limit });
  if (error) throw error;
  return (data ?? []) as ScheduledMessageRow[];
}

export async function markSent(id: string, sentTo: string | null): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("scheduled_messages")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_to: sentTo,
      last_error: null,
    })
    .eq("id", id);
  if (error) throw error;
}

/** Transient failure: backoff + retry via RPC; dead at 5 attempts. */
export async function markFailed(id: string, errorMessage: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("mark_scheduled_message_failed", {
    p_id: id,
    p_error: errorMessage,
  });
  if (error) throw error;
}

/** Failure retrying cannot fix (opt-out, missing address, sms unconfigured). */
export async function markFailedPermanent(id: string, errorMessage: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("scheduled_messages")
    .update({ status: "failed", last_error: errorMessage })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Put a claimed row back in the queue at a later time WITHOUT consuming an
 * attempt — used for quiet-hours and rate-limit deferrals, which are not
 * failures.
 */
export async function requeueAt(id: string, when: Date, note?: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("scheduled_messages")
    .update({
      status: "queued",
      send_at: when.toISOString(),
      ...(note ? { last_error: note } : {}),
    })
    .eq("id", id);
  if (error) throw error;
}

/** Cancel a claimed row from inside the worker (e.g. condition cleared). */
export async function markCancelledBySystem(id: string, reason: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("scheduled_messages")
    .update({ status: "cancelled", last_error: reason })
    .eq("id", id);
  if (error) throw error;
}

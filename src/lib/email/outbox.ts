import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Backoff delays in minutes: 1m, 5m, 15m, 60m, 6h (used in DB function) */

export type EmailOutboxRow = {
  id: string;
  tenant_id: string | null;
  to: string;
  subject: string;
  html: string;
  text: string | null;
  status: "queued" | "sending" | "sent" | "failed";
  attempts: number;
  last_error: string | null;
  provider_message_id: string | null;
  send_after: string;
  created_at: string;
  updated_at: string;
};

export type EnqueueEmailParams = {
  tenantId?: string | null;
  to: string;
  subject: string;
  html: string;
  text?: string | null;
};

/**
 * Insert a new email into the outbox with status queued.
 */
export async function enqueueEmail({
  tenantId,
  to,
  subject,
  html,
  text,
}: EnqueueEmailParams): Promise<{ id: string }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("email_outbox")
    .insert({
      tenant_id: tenantId ?? null,
      to,
      subject,
      html,
      text: text ?? null,
      status: "queued",
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("Insert did not return id");
  return { id: data.id };
}

/**
 * Atomically claim up to `limit` queued rows (sendAfter <= now, attempts < 5),
 * marking them as sending. Returns the claimed rows. Uses FOR UPDATE SKIP LOCKED in DB.
 */
export async function claimNextBatch(
  limit = 10
): Promise<EmailOutboxRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("claim_email_outbox_batch", {
    lim: limit,
  });
  if (error) throw error;
  return (data ?? []) as EmailOutboxRow[];
}

/**
 * Mark a claimed row as sent and store the provider message id.
 */
export async function markSent(
  id: string,
  messageId: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("email_outbox")
    .update({
      status: "sent",
      provider_message_id: messageId,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Mark a claimed row as failed: increment attempts, set lastError.
 * If attempts < 5: set status back to queued and sendAfter = now + backoff.
 * If attempts >= 5: set status to failed. Implemented in DB RPC.
 */
export async function markFailed(id: string, errorMessage: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("mark_email_outbox_failed", {
    p_id: id,
    p_error: errorMessage,
  });
  if (error) throw error;
}

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type LogEmailSendErrorParams = {
  /** Agency the failed send belonged to. Null only when enqueue-time data was malformed. */
  tenantId: string | null;
  message: string;
  context?: Record<string, unknown>;
};

/**
 * Best-effort write to error_events with source='email_send'. Never throws —
 * a logging failure must not mask the underlying send failure.
 */
export async function logEmailSendError({
  tenantId,
  message,
  context = {},
}: LogEmailSendErrorParams): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("error_events").insert({
      tenant_id: tenantId,
      source: "email_send",
      message,
      context,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[email] failed to write error_events row", { tenantId, errMsg, originalMessage: message });
  }
}

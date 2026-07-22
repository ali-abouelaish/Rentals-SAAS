import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { EmailProviderType } from "./transport/types";

export type LogEmailEntry = {
  /** Agency the send belonged to. Null only when the caller has no tenant. */
  tenantId: string | null;
  providerType: EmailProviderType;
  to: string;
  subject: string;
  templateKey?: string | null;
  messageId?: string | null;
  status: "sent" | "failed";
  error?: string | null;
};

/**
 * Best-effort write to email_log. Never throws — an audit-logging failure must
 * not mask (or block) the underlying send. Writes via the admin client because
 * email_log has no insert policy (service-role only).
 */
export async function logEmail(entry: LogEmailEntry): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("email_log").insert({
      tenant_id: entry.tenantId,
      provider_type: entry.providerType,
      to: entry.to,
      subject: entry.subject,
      template_key: entry.templateKey ?? null,
      message_id: entry.messageId ?? null,
      status: entry.status,
      error: entry.error ?? null,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[email] failed to write email_log row", { tenantId: entry.tenantId, errMsg });
  }
}

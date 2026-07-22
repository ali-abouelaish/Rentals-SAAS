import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptProviderCredentials } from "./encrypt";
import type {
  EmailProviderConfig,
  EmailProviderStatus,
  EmailProviderType,
  OAuthCredentials,
  SmtpCredentials,
} from "@/lib/email/transport/types";

/**
 * Load an agency's active email provider config, with credentials decrypted.
 *
 * Returns null when the agency has no provider row, or the row isn't 'active',
 * so callers transparently fall back to the central Resend mailer. Reads via
 * the admin client because email_providers is service-role only (RLS, no
 * policies) and holds an encrypted secret.
 */
export async function getEmailProvider(tenantId: string): Promise<EmailProviderConfig | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("email_providers")
    .select("tenant_id, type, status, from_address, from_name, reply_to, credentials")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load email provider for tenant ${tenantId}: ${error.message}`);
  if (!data) return null;

  const status = data.status as EmailProviderStatus;
  const type = data.type as EmailProviderType;
  if (status !== "active" || type === "resend_default") return null;

  let credentials: OAuthCredentials | SmtpCredentials | null = null;
  if (data.credentials) {
    credentials = JSON.parse(decryptProviderCredentials(data.credentials as string)) as
      | OAuthCredentials
      | SmtpCredentials;
  }

  return {
    tenantId: data.tenant_id as string,
    type,
    status,
    fromAddress: (data.from_address as string | null) ?? null,
    fromName: (data.from_name as string | null) ?? null,
    replyTo: (data.reply_to as string | null) ?? null,
    credentials,
  };
}

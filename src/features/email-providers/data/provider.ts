import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptProviderCredentials } from "@/lib/email-providers/encrypt";
import type {
  EmailProviderStatus,
  EmailProviderType,
  SmtpCredentials,
} from "@/lib/email/transport/types";

/** Non-secret provider fields for the settings UI (credentials never selected). */
export type EmailProviderStatusView = {
  type: EmailProviderType;
  status: EmailProviderStatus;
  fromAddress: string | null;
  fromName: string | null;
  verifiedAt: string | null;
  lastError: string | null;
};

/**
 * Read an agency's email provider config for display. Uses the admin client
 * because email_providers is service-role only (RLS, no policies); the caller
 * (settings page) has already authorized the tenant via requireRole.
 */
export async function getEmailProviderStatus(tenantId: string): Promise<EmailProviderStatusView | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("email_providers")
    .select("type, status, from_address, from_name, verified_at, last_error")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.type === "resend_default") return null;

  return {
    type: data.type as EmailProviderType,
    status: data.status as EmailProviderStatus,
    fromAddress: (data.from_address as string | null) ?? null,
    fromName: (data.from_name as string | null) ?? null,
    verifiedAt: (data.verified_at as string | null) ?? null,
    lastError: (data.last_error as string | null) ?? null,
  };
}

/** Non-secret SMTP fields for prefilling the edit form. Password is never returned. */
export type SmtpConfigForEdit = {
  fromAddress: string;
  fromName: string;
  replyTo: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
};

export async function getSmtpConfigForEdit(tenantId: string): Promise<SmtpConfigForEdit | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("email_providers")
    .select("type, from_address, from_name, reply_to, credentials")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.type !== "smtp" || !data.credentials) return null;

  const creds = JSON.parse(decryptProviderCredentials(data.credentials as string)) as SmtpCredentials;
  return {
    fromAddress: (data.from_address as string | null) ?? "",
    fromName: (data.from_name as string | null) ?? "",
    replyTo: (data.reply_to as string | null) ?? "",
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    username: creds.user,
  };
}

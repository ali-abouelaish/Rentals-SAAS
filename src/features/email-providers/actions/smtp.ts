"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptProviderCredentials, decryptProviderCredentials } from "@/lib/email-providers/encrypt";
import { verifySmtp } from "@/lib/email-providers/smtp/verify";
import { smtpProviderSchema, type SmtpProviderValues } from "../domain/schemas";
import type { SmtpCredentials } from "@/lib/email/transport/types";

type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Save an agency's SMTP provider: validate, test the connection (verify), then
 * store the credentials encrypted and activate. The connection is tested BEFORE
 * anything is persisted, so an unreachable/misconfigured server never becomes
 * the active provider. On edit, a blank password keeps the stored one.
 */
export async function saveSmtpProvider(input: SmtpProviderValues): Promise<SaveResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const tenantId = profile.tenant_id;

  const parsed = smtpProviderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid SMTP settings." };
  }
  const v = parsed.data;

  const admin = createSupabaseAdminClient();

  // Resolve the password: use the provided one, else fall back to the stored
  // password when editing an existing SMTP connection.
  let password = v.password?.trim() ?? "";
  if (!password) {
    const { data: existing } = await admin
      .from("email_providers")
      .select("type, credentials")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (existing?.type === "smtp" && existing.credentials) {
      const prev = JSON.parse(decryptProviderCredentials(existing.credentials as string)) as SmtpCredentials;
      password = prev.pass;
    }
    if (!password) {
      return { ok: false, error: "Password is required." };
    }
  }

  const creds: SmtpCredentials = {
    host: v.host,
    port: v.port,
    secure: v.secure,
    user: v.username,
    pass: password,
  };

  try {
    await verifySmtp(creds);
  } catch (err) {
    return {
      ok: false,
      error: `Connection test failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const { error } = await admin.from("email_providers").upsert(
    {
      tenant_id: tenantId,
      type: "smtp",
      credentials: encryptProviderCredentials(JSON.stringify(creds)),
      from_address: v.fromAddress,
      from_name: v.fromName?.trim() || null,
      reply_to: v.replyTo?.trim() || null,
      status: "active",
      verified_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "tenant_id" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/email");
  return { ok: true };
}

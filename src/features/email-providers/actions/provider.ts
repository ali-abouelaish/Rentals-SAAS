"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadAgency } from "@/lib/email/agency-context";
import { sendEmail } from "@/lib/email/send";
import { getEmailProviderStatus } from "../data/provider";

/**
 * Send a test email through the agency's configured provider to verify the
 * connection end-to-end. Goes to the connected mailbox / from-address itself (a
 * self-send is a clean connectivity check). Routes through sendEmail, which
 * resolves the active provider — so a fallback to Resend means the connection
 * is not usable.
 */
export async function sendProviderTestEmail(): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);

  const provider = await getEmailProviderStatus(profile.tenant_id);
  if (!provider || provider.status !== "active") {
    return { ok: false, error: "No active email connection to test." };
  }
  const recipient = provider.fromAddress;
  if (!recipient) {
    return { ok: false, error: "Connected from-address is missing." };
  }

  const agency = await loadAgency(profile.tenant_id);
  if (!agency) return { ok: false, error: "Agency not found." };

  try {
    const { providerType } = await sendEmail(
      profile.tenant_id,
      {
        to: recipient,
        subject: "Harbor Ops test email",
        html: `<p>This is a test email from Harbor Ops confirming your ${provider.type} email connection is working.</p>`,
        text: `This is a test email from Harbor Ops confirming your ${provider.type} email connection is working.`,
        templateKey: "provider_test",
      },
      { agency },
    );

    if (providerType === "resend_default") {
      // The active provider didn't handle it (it fell back) — connection unusable.
      return { ok: false, error: "The connection is not usable; the test fell back to the default mailer." };
    }

    revalidatePath("/settings/email");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Test send failed." };
  }
}

/** Disconnect the agency's custom provider, reverting to the default Resend mailer. */
export async function disconnectEmailProvider(): Promise<{ ok: true }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("email_providers").delete().eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/email");
  return { ok: true };
}

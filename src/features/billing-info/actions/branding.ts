"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { loadAgency } from "@/lib/email/agency-context";
import { notifyAgencyOfRequest } from "@/lib/email/notify-agency";
import { normalizeBranding } from "@/lib/email/branding";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Persist the agency's reply-to email. Reminder mail sets `Reply-To` to this
 * address so tenants can reply to a real mailbox instead of the noreply
 * sending alias.
 */
export async function updateReplyToEmail(formData: FormData) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const raw = String(formData.get("reply_to_email") ?? "").trim();

  if (raw && !EMAIL_RE.test(raw)) {
    return { error: "Enter a valid email address." };
  }

  const admin = createSupabaseAdminClient();

  const { data: existing, error: loadErr } = await admin
    .from("tenants")
    .select("branding")
    .eq("id", profile.tenant_id)
    .single();
  if (loadErr) return { error: loadErr.message };

  const next = normalizeBranding(existing?.branding);
  next.reply_to_email = raw;

  const { error } = await admin
    .from("tenants")
    .update({ branding: next })
    .eq("id", profile.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/settings/billing-info");
  return { success: true };
}

/**
 * Insert a real sample tenant_communication_requests row + send the agency
 * notification, so admins can see the Inbox dashboard populate end-to-end
 * without going through the public preferences page.
 */
export async function createSampleInboxRequest(): Promise<
  { success: true; requestId: string } | { error: string }
> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();

  const { data: pm, error: pmErr } = await admin
    .from("pm_tenants")
    .select("id, full_name, email")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pmErr) return { error: pmErr.message };
  if (!pm) {
    return { error: "Add at least one tenant first — sample requests need a pm_tenant to attach to." };
  }

  const payload = {
    current_email: pm.email,
    requested_email: "new-address@example.com",
  };

  const { data: inserted, error: insertErr } = await admin
    .from("tenant_communication_requests")
    .insert({
      tenant_id: profile.tenant_id,
      pm_tenant_id: pm.id,
      request_type: "email_change",
      payload,
      ip_address: null,
      user_agent: "sample-from-settings",
    })
    .select("id")
    .single();
  if (insertErr) return { error: insertErr.message };

  const agency = await loadAgency(profile.tenant_id);
  if (agency) {
    try {
      await notifyAgencyOfRequest({
        agency,
        pmTenantName: (pm.full_name as string) ?? "Sample Tenant",
        propertyAddress: "12 Sample Road, London SW1 1AA",
        requestId: inserted.id as string,
        requestType: "email_change",
        payload,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[email] sample notify failed", message);
      // Row still inserted; not fatal for the inbox preview.
    }
  }

  revalidatePath("/inbox");
  return { success: true, requestId: inserted.id as string };
}

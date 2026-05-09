"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function updateAgencyContactEmail(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const contact_email = String(formData.get("contact_email") ?? "").trim();

  if (!contact_email) return { ok: false, error: "Contact email is required." };
  if (!EMAIL_RE.test(contact_email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("tenants")
    .update({ contact_email })
    .eq("id", profile.tenant_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/billing-info");
  return { ok: true };
}

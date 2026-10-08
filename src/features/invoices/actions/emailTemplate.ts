"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { loadAgencyBrand } from "@/lib/branding/agency-brand";
import { loadAgencyContactEmail } from "@/lib/email/contact";
import {
  INVOICE_EMAIL_TEMPLATE_KEY,
  INVOICE_MERGE_EXAMPLES,
  invoiceEmailSchema,
  type InvoiceEmailValues,
} from "../domain/email";
import { composeInvoiceEmail, fillInvoiceTemplate } from "../lib/compose";

export type TemplateActionResult = { ok: true } | { ok: false; error: string };

/** Save the agency's own invoice email. Admins only (also enforced by RLS). */
export async function saveInvoiceEmailTemplate(
  values: InvoiceEmailValues
): Promise<TemplateActionResult> {
  const parsed = invoiceEmailSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid template." };
  }
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.from("email_templates").upsert(
    {
      tenant_id: profile.tenant_id,
      key: INVOICE_EMAIL_TEMPLATE_KEY,
      subject: parsed.data.subject,
      body: parsed.data.body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,key" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/billing-profiles");
  return { ok: true };
}

/** Drop the agency's copy so the built-in default applies again. */
export async function resetInvoiceEmailTemplate(): Promise<TemplateActionResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("tenant_id", profile.tenant_id)
    .eq("key", INVOICE_EMAIL_TEMPLATE_KEY);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/billing-profiles");
  return { ok: true };
}

/** Render the template being edited against example values, with branding applied. */
export async function previewInvoiceEmailTemplate(
  values: InvoiceEmailValues
): Promise<{ ok: true; html: string; unknownKeys: string[] } | { ok: false; error: string }> {
  const parsed = invoiceEmailSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid template." };
  }
  const profile = await requireRole([...ADMIN_ROLES]);

  const brand = await loadAgencyBrand(profile.tenant_id);
  if (!brand) return { ok: false, error: "Agency not found." };
  const contactEmail = await loadAgencyContactEmail(profile.tenant_id).catch(() => null);

  const context = { ...INVOICE_MERGE_EXAMPLES, agency_name: brand.displayName };
  const filled = fillInvoiceTemplate(parsed.data, context);
  const { html } = composeInvoiceEmail({
    brand,
    contactEmail,
    subject: filled.subject,
    body: filled.body,
    context,
  });
  return { ok: true, html, unknownKeys: filled.unknownKeys };
}

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_INVOICE_EMAIL, INVOICE_EMAIL_TEMPLATE_KEY } from "../domain/email";

export type InvoiceEmailTemplate = {
  subject: string;
  body: string;
  /** True when the agency has not saved its own copy and gets the built-in one. */
  isDefault: boolean;
};

/**
 * The agency's invoice email template, or the built-in default when they have
 * never saved one. Nothing is seeded: "reset to default" is just deleting the row.
 */
export async function getInvoiceEmailTemplate(tenantId: string): Promise<InvoiceEmailTemplate> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("tenant_id", tenantId)
    .eq("key", INVOICE_EMAIL_TEMPLATE_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!data) return { ...DEFAULT_INVOICE_EMAIL, isDefault: true };
  return { subject: data.subject as string, body: data.body as string, isDefault: false };
}

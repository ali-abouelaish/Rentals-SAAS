"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { enqueueEmail } from "@/lib/email/outbox";
import { generateFormLinkEmail } from "@/lib/email/templates/form-link";
import { buildTenantAppUrl } from "@/lib/urls";

export async function sendFormLinks(
  formId: string,
  emails: string[]
): Promise<{ sent: number; errors: string[] }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: form } = await supabase
    .from("forms")
    .select("id, name, public_slug")
    .eq("id", formId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!form) throw new Error("Form not found");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, branding:tenant_branding_settings(brand_name)")
    .eq("id", profile.tenant_id)
    .single();

  const agencyName =
    (tenant?.branding as { brand_name?: string | null } | null)?.brand_name ??
    tenant?.name ??
    "Your agency";

  const appUrl = buildTenantAppUrl(headers());
  const formUrl = `${appUrl}/f/${form.public_slug}`;

  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];

  let sent = 0;
  const errors: string[] = [];

  await Promise.all(
    unique.map(async (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push(`${email}: invalid email address`);
        return;
      }

      try {
        const { subject, html, text } = generateFormLinkEmail({
          formName: form.name,
          formUrl,
          agencyName,
        });

        await enqueueEmail({
          tenantId: profile.tenant_id,
          to: email,
          subject,
          html,
          text,
        });

        sent++;
      } catch (err) {
        errors.push(`${email}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    })
  );

  return { sent, errors };
}

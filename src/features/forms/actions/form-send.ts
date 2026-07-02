"use server";

import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { sendAgencyEmail } from "@/lib/email/agency-send";
import { loadAgency } from "@/lib/email/agency-context";
import { generateFormLinkEmail } from "@/lib/email/templates/form-link";
import { buildTenantAppUrl } from "@/lib/urls";

export async function sendFormLinks(
  formId: string,
  emails: string[],
  bookingId?: string
): Promise<{ sent: number; errors: string[] }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: form } = await supabase
    .from("forms")
    .select("id, name, public_slug, portfolio:portfolios(name)")
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

  // An agency can run several portfolios/brands. Send the form under the form's
  // portfolio name when it has one, so the recipient sees the right brand.
  const portfolioRel = (form as { portfolio?: { name?: string | null } | { name?: string | null }[] | null }).portfolio;
  const portfolioObj = Array.isArray(portfolioRel) ? portfolioRel[0] : portfolioRel;
  const senderName = portfolioObj?.name?.trim() || agencyName;

  // Agency record (branding + reply-to) used to send directly via Resend.
  const agency = await loadAgency(profile.tenant_id);
  if (!agency) throw new Error("Agency not found");

  const appUrl = buildTenantAppUrl(headers());

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
        // Mint a per-recipient token so the submission can be attributed back to
        // this send (and its booking, when one is provided).
        const token = randomUUID();
        const { data: sendRow, error: insertError } = await supabase
          .from("booking_form_sends")
          .insert({
            tenant_id: profile.tenant_id,
            booking_id: bookingId ?? null,
            form_id: form.id,
            recipient_email: email,
            token,
          })
          .select("id")
          .single();
        if (insertError || !sendRow) throw new Error(insertError?.message ?? "Failed to record send");

        const formUrl = `${appUrl}/f/${form.public_slug}?t=${token}`;
        const { subject, html, text } = generateFormLinkEmail({
          formName: form.name,
          formUrl,
          agencyName: senderName,
        });

        try {
          // Send immediately via Resend (rather than queuing in email_outbox)
          // so the caller gets real delivery success/failure.
          await sendAgencyEmail({ agency, to: email, subject, html, text });
        } catch (sendErr) {
          // Roll back the send record so a failed email isn't shown as "Sent".
          await supabase.from("booking_form_sends").delete().eq("id", sendRow.id);
          throw sendErr;
        }

        sent++;
      } catch (err) {
        errors.push(`${email}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    })
  );

  return { sent, errors };
}

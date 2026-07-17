"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { LOGIN_TOKEN_TTL_MS, signPortalToken } from "@/lib/portal/token";
import { loadAgency } from "@/lib/email/agency-context";
import { sendAgencyEmail } from "@/lib/email/agency-send";
import { generatePortalLoginEmail } from "@/lib/email/templates/portal-login";
import { buildTenantAppUrl } from "@/lib/urls";
import { markPortalInvited } from "../data/queries";

/**
 * Staff action: email a renter a portal sign-in link from the Tenants page.
 */
export async function sendPortalInvite(
  pmTenantId: string
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);

  const entitlements = await getEntitlements();
  if (!entitlements.has("tenant_portal")) {
    return { ok: false, error: "Tenant portal is not enabled for this workspace" };
  }

  const supabase = createSupabaseServerClient();
  const { data: pmTenant, error } = await supabase
    .from("pm_tenants")
    .select("id, full_name, email")
    .eq("id", pmTenantId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!pmTenant) return { ok: false, error: "Tenant not found" };
  if (!pmTenant.email?.trim()) {
    return { ok: false, error: "This tenant has no email address on file" };
  }

  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("name, slug, branding:tenant_branding_settings(brand_name)")
    .eq("id", profile.tenant_id)
    .maybeSingle();
  const brandingRel = tenantRow?.branding as
    | { brand_name?: string | null }
    | { brand_name?: string | null }[]
    | null
    | undefined;
  const brandingObj = Array.isArray(brandingRel) ? brandingRel[0] : brandingRel;
  const agencyName =
    brandingObj?.brand_name?.trim() || tenantRow?.name || "Your letting agent";

  const emailLower = pmTenant.email.trim().toLowerCase();
  const token = signPortalToken(
    {
      typ: "login",
      pmTenantId: pmTenant.id,
      tenantId: profile.tenant_id,
      email: emailLower,
    },
    LOGIN_TOKEN_TTL_MS
  );

  // Staff are already on the tenant subdomain, so the request host carries
  // the right base. On localhost there is no subdomain — carry the slug as a
  // query param the portal's tenant resolution understands.
  const appUrl = buildTenantAppUrl(headers());
  const isLocal = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
  const devSuffix =
    isLocal && tenantRow?.slug ? `&companySlug=${encodeURIComponent(tenantRow.slug)}` : "";
  const loginUrl = `${appUrl}/portal/auth?token=${encodeURIComponent(token)}${devSuffix}`;
  const portalLoginUrl = isLocal && tenantRow?.slug
    ? `${appUrl}/portal/login?companySlug=${encodeURIComponent(tenantRow.slug)}`
    : `${appUrl}/portal/login`;

  if (process.env.NODE_ENV === "development") {
    console.log(`[portal] invite link for ${emailLower}: ${loginUrl}`);
  }

  const agency = await loadAgency(profile.tenant_id);
  if (!agency) return { ok: false, error: "Agency not found" };

  const firstName = pmTenant.full_name.trim().split(/\s+/)[0] ?? pmTenant.full_name;
  const { subject, html, text } = generatePortalLoginEmail({
    agencyName,
    renterFirstName: firstName,
    loginUrl,
    portalLoginUrl,
    invitedByAgency: true,
  });

  try {
    await sendAgencyEmail({
      agency,
      to: pmTenant.email,
      subject,
      html,
      text,
      pmTenantId: pmTenant.id,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }

  await markPortalInvited(profile.tenant_id, pmTenant.id);
  return { ok: true };
}

import { LOGIN_TOKEN_TTL_MS, signPortalToken } from "@/lib/portal/token";
import { tenantAppUrl } from "@/lib/email/app-url";
import { loadAgency } from "@/lib/email/agency-context";
import { sendAgencyEmail } from "@/lib/email/agency-send";
import { generatePortalLoginEmail } from "@/lib/email/templates/portal-login";
import { rateLimitCheck } from "@/features/property-shares/lib/rate-limit";
import { findPmTenantForLogin } from "../data/queries";
import type { ResolvedPortalTenant } from "../data/resolve";

export type RequestPortalLoginLinkParams = {
  tenant: ResolvedPortalTenant;
  email: string;
  ip: string;
  /** Dev-only override (request origin) used when the app runs on localhost,
   *  where tenantAppUrl can't derive the subdomain. */
  devBaseUrl?: string | null;
};

/**
 * Issue a portal magic link. Always resolves `{ ok: true }` — unknown emails,
 * rate-limited requests, and send failures are indistinguishable from success
 * so the endpoint can't be used to enumerate a renter list.
 */
export async function requestPortalLoginLink({
  tenant,
  email,
  ip,
  devBaseUrl,
}: RequestPortalLoginLinkParams): Promise<{ ok: true }> {
  const emailLower = email.trim().toLowerCase();

  const ipCheck = rateLimitCheck(`portal-login:ip:${ip}`, 15 * 60_000, 5);
  const emailCheck = rateLimitCheck(
    `portal-login:email:${tenant.id}:${emailLower}`,
    15 * 60_000,
    3
  );
  if (!ipCheck.allowed || !emailCheck.allowed) {
    return { ok: true };
  }

  const pmTenant = await findPmTenantForLogin(tenant.id, emailLower);
  if (!pmTenant) {
    return { ok: true };
  }

  const token = signPortalToken(
    { typ: "login", pmTenantId: pmTenant.id, tenantId: tenant.id, email: emailLower },
    LOGIN_TOKEN_TTL_MS
  );

  const devSuffix = devBaseUrl ? `&companySlug=${encodeURIComponent(tenant.slug)}` : "";
  const loginUrl = devBaseUrl
    ? `${devBaseUrl}/portal/auth?token=${encodeURIComponent(token)}${devSuffix}`
    : tenantAppUrl(tenant.slug, `/portal/auth?token=${encodeURIComponent(token)}`);
  const portalLoginUrl = devBaseUrl
    ? `${devBaseUrl}/portal/login?companySlug=${encodeURIComponent(tenant.slug)}`
    : tenantAppUrl(tenant.slug, "/portal/login");

  if (process.env.NODE_ENV === "development") {
    console.log(`[portal] magic link for ${emailLower}: ${loginUrl}`);
  }

  try {
    const agency = await loadAgency(tenant.id);
    if (!agency) return { ok: true };

    const firstName = pmTenant.fullName.trim().split(/\s+/)[0] ?? pmTenant.fullName;
    const { subject, html, text } = generatePortalLoginEmail({
      agencyName: tenant.branding?.brand_name?.trim() || tenant.name,
      renterFirstName: firstName,
      loginUrl,
      portalLoginUrl,
      invitedByAgency: false,
    });

    await sendAgencyEmail({
      agency,
      to: pmTenant.email,
      subject,
      html,
      text,
      pmTenantId: pmTenant.id,
    });
  } catch {
    // Swallow send failures (already logged by sendAgencyEmail) — the caller
    // response must not reveal whether an email exists or was sent.
  }

  return { ok: true };
}

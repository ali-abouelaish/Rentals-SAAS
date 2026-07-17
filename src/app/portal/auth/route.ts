import { NextRequest, NextResponse } from "next/server";
import { verifyPortalToken } from "@/lib/portal/token";
import { createPortalSessionCookie } from "@/lib/portal/session";
import { resolvePortalTenantFromRequest } from "@/features/portal/data/resolve";
import {
  getPortalPmTenant,
  updateLastPortalLogin,
} from "@/features/portal/data/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Magic-link landing: verify the login token, set the session cookie. */
export async function GET(request: NextRequest) {
  const companySlug = request.nextUrl.searchParams.get("companySlug");
  const slugParam = companySlug
    ? `companySlug=${encodeURIComponent(companySlug)}&`
    : "";
  const failUrl = new URL(`/portal/login?${slugParam}err=expired`, request.url);

  const token = request.nextUrl.searchParams.get("token") ?? "";
  const claims = verifyPortalToken(token, "login");
  if (!claims) return NextResponse.redirect(failUrl, 303);

  const tenant = await resolvePortalTenantFromRequest(request);
  if (!tenant || tenant.id !== claims.tenantId) {
    return NextResponse.redirect(failUrl, 303);
  }

  // Re-check the email claim against the live record: staff correcting a
  // mistyped address must invalidate links sent to the old one.
  const pmTenant = await getPortalPmTenant(tenant.id, claims.pmTenantId);
  if (!pmTenant || pmTenant.email.trim().toLowerCase() !== claims.email) {
    return NextResponse.redirect(failUrl, 303);
  }

  const dashboardUrl = new URL(
    `/portal${companySlug ? `?companySlug=${encodeURIComponent(companySlug)}` : ""}`,
    request.url
  );
  const res = NextResponse.redirect(dashboardUrl, 303);
  createPortalSessionCookie(res, {
    pmTenantId: claims.pmTenantId,
    tenantId: tenant.id,
  });

  updateLastPortalLogin(tenant.id, claims.pmTenantId).catch(() => {});

  return res;
}

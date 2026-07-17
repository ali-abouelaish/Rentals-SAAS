import { NextRequest, NextResponse } from "next/server";
import { SUPPORT_CTX_TTL_MS, signPortalToken } from "@/lib/portal/token";
import { getPortalSessionFromRequest } from "@/lib/portal/session";
import { resolvePortalTenantFromRequest } from "@/features/portal/data/resolve";
import { getPortalCurrentUnit } from "@/features/portal/data/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Report a new issue": bounce the signed-in renter into the public /support
 * AI triage chat with a short-lived context token so they skip the
 * property/unit self-selection step.
 */
export async function GET(request: NextRequest) {
  const companySlug = request.nextUrl.searchParams.get("companySlug");
  const slugSuffix = companySlug
    ? `?companySlug=${encodeURIComponent(companySlug)}`
    : "";

  const tenant = await resolvePortalTenantFromRequest(request);
  const session = getPortalSessionFromRequest(request);
  if (!tenant || !session || session.tenantId !== tenant.id) {
    return NextResponse.redirect(new URL(`/portal/login${slugSuffix}`, request.url), 303);
  }

  const unit = await getPortalCurrentUnit(tenant.id, session.pmTenantId);
  if (!unit) {
    const backUrl = new URL(
      `/portal?${companySlug ? `companySlug=${encodeURIComponent(companySlug)}&` : ""}err=no_unit`,
      request.url
    );
    return NextResponse.redirect(backUrl, 303);
  }

  const ctx = signPortalToken(
    { typ: "support", pmTenantId: session.pmTenantId, tenantId: tenant.id },
    SUPPORT_CTX_TTL_MS
  );
  const supportUrl = new URL(
    `/support?ctx=${encodeURIComponent(ctx)}${
      companySlug ? `&companySlug=${encodeURIComponent(companySlug)}` : ""
    }`,
    request.url
  );
  return NextResponse.redirect(supportUrl, 303);
}

import { NextRequest, NextResponse } from "next/server";
import { clearPortalSessionCookie } from "@/lib/portal/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const companySlug = request.nextUrl.searchParams.get("companySlug");
  const loginUrl = new URL(
    `/portal/login${companySlug ? `?companySlug=${encodeURIComponent(companySlug)}` : ""}`,
    request.url
  );
  const res = NextResponse.redirect(loginUrl, 303);
  clearPortalSessionCookie(res);
  return res;
}

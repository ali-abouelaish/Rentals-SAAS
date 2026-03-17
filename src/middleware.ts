import { NextRequest, NextResponse } from "next/server";
import { createSupabaseMiddlewareClient } from "./lib/supabase/middleware";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/invite",
  "/public",
  "/invite/accept",
  "/invite/set-password",
  "/api/invite/complete",
  "/auth/error"
];

function getTenantFromHost(host: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();
  const parts = hostname.split(".");

  // e.g. truehold.harborops.co.uk -> ["truehold","harborops","co","uk"]
  if (parts.length > 2) {
    return parts[0] || null;
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const tenantSlug = getTenantFromHost(host);

  const { supabase, response } = createSupabaseMiddlewareClient(request);
  // Use getSession() here (reads from cookie JWT, no network call unless token needs refresh).
  // Full getUser() validation happens inside requireUserProfile() in each server action/page,
  // so security is maintained where it matters. This avoids hitting Supabase auth rate limits
  // when many agents submit concurrently.
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  const isApiRoute = pathname.startsWith("/api/");

  const user = session?.user ?? null;

  if (!user && !isPublic && !isApiRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  // Attach tenant slug so server components / API routes can read it via headers().get("x-tenant")
  if (tenantSlug) {
    response.headers.set("x-tenant", tenantSlug);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

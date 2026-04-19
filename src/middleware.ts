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
  "/api/leads/webhook",
  "/api/gmail/callback",
  "/api/support",
  "/support",
  "/auth/error",
  "/s",
  "/api/shares"
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

  // Fallback: if Supabase redirected a ?code to the root instead of /auth/callback,
  // forward it to /auth/callback so the session exchange works correctly.
  const code = request.nextUrl.searchParams.get("code");
  const type = request.nextUrl.searchParams.get("type");
  if (code && pathname === "/") {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    // Preserve an existing `next` param if Supabase passed it through; otherwise
    // derive from `type`. Note: the onAuthStateChange PASSWORD_RECOVERY handler in
    // /auth/callback is the authoritative redirect for recovery sessions.
    const existingNext = request.nextUrl.searchParams.get("next");
    const resolvedNext =
      existingNext ??
      (type === "recovery"
        ? "/reset-password"
        : type === "invite"
        ? "/invite/set-password"
        : "/me");
    callbackUrl.searchParams.set("next", resolvedNext);
    return NextResponse.redirect(callbackUrl);
  }

  // On tenant subdomains, the root always redirects to login
  if (tenantSlug && pathname === "/") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

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

  // Property share links must never be indexed by crawlers.
  if (pathname.startsWith("/s/") || pathname === "/s") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

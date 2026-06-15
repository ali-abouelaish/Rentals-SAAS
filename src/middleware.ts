import { NextRequest, NextResponse } from "next/server";
import { createSupabaseMiddlewareClient } from "./lib/supabase/middleware";
import { getTenantIdBySlug, getUserTenant } from "./lib/tenant-slug-cache";

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
  "/api/shares",
  "/apply",
  "/f",
  "/preferences",
  "/tenant-not-found"
];

function getTenantFromHost(host: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();

  const portalRaw = process.env.APP_PORTAL_DOMAIN;
  const portal = portalRaw
    ? portalRaw.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase()
    : null;

  if (portal) {
    if (hostname === portal || hostname === `www.${portal}`) return null;
    if (hostname.endsWith(`.${portal}`)) {
      const sub = hostname.slice(0, -1 - portal.length);
      if (!sub || sub === "www") return null;
      return sub.split(".")[0] || null;
    }
    return null;
  }

  const parts = hostname.split(".");
  if (parts.length > 2) {
    const [first] = parts;
    if (first && first !== "www") return first;
  }
  return null;
}

/**
 * Copy any Set-Cookie entries Supabase wrote on `from` onto `to`. We must do
 * this on every early return (redirect / rewrite), otherwise refreshed auth
 * tokens get silently dropped. Because Supabase rotates the refresh token on
 * every refresh, losing those Set-Cookies invalidates the user's session on
 * the next request — the symptom users see as "logged in for a moment, then
 * bounced to /login on the next click".
 */
function withAuthCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
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
    return withAuthCookies(response, NextResponse.redirect(callbackUrl));
  }

  // Validate the tenant subdomain against the DB before letting any request
  // through. Catches typos like "truehlod.harborops.co.uk" — without this the
  // login page would render, sign-in would succeed, and the user would only
  // get bounced once a tenant-scoped query failed downstream.
  // Skip validation for the not-found page itself to avoid an infinite rewrite.
  if (tenantSlug && pathname !== "/tenant-not-found") {
    const resolvedTenantId = await getTenantIdBySlug(tenantSlug);
    if (!resolvedTenantId) {
      const notFoundUrl = request.nextUrl.clone();
      notFoundUrl.pathname = "/tenant-not-found";
      return withAuthCookies(response, NextResponse.rewrite(notFoundUrl, { status: 404 }));
    }

    // If the slug is valid but the signed-in user belongs to a different
    // tenant, send them to their own subdomain rather than letting them browse
    // someone else's workspace shell (RLS would block reads anyway, but the
    // dashboard chrome shouldn't render).
    const sessionUser = session?.user;
    if (sessionUser && process.env.NODE_ENV !== "development") {
      const { tenantId: userTenantId, slug: userSlug } = await getUserTenant(sessionUser.id);
      if (userTenantId && userSlug && userTenantId !== resolvedTenantId) {
        const portalRaw = process.env.APP_PORTAL_DOMAIN;
        const portal = portalRaw
          ? portalRaw.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase()
          : null;
        if (portal) {
          const target = new URL(`https://${userSlug}.${portal}/dashboard`);
          return withAuthCookies(response, NextResponse.redirect(target));
        }
      }
    }
  }

  // On tenant subdomains, the root always redirects to login
  if (tenantSlug && pathname === "/") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return withAuthCookies(response, NextResponse.redirect(loginUrl));
  }

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  const isApiRoute = pathname.startsWith("/api/");
  // Apex-domain landing page: harborops.co.uk/ (no subdomain) renders the
  // marketing page. Tenant subdomain roots still fall through to the
  // tenantSlug redirect above.
  const isApexLanding = !tenantSlug && pathname === "/";

  const user = session?.user ?? null;

  if (!user && !isPublic && !isApiRoute && !isApexLanding) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return withAuthCookies(response, NextResponse.redirect(redirectUrl));
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
  // Skip Next internals and static files served from /public (images, fonts,
  // pdfjs assets, etc.). Without the file-extension exclusion, requests like
  // GET /harbor-logo.png run through the auth gate and get redirected to /login
  // for logged-out visitors — so the logo (and every public asset) fails to
  // load on the auth pages.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|mjs|map|woff|woff2|ttf|eot|pdf)$).*)"
  ]
};

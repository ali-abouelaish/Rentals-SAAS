import { NextRequest, NextResponse } from "next/server";
import { createSupabaseMiddlewareClient } from "./lib/supabase/middleware";
import { getSharedCookieDomain } from "./lib/supabase/cookie-domain";
import { getTenantIdBySlug, getUserTenant } from "./lib/tenant-slug-cache";
import { getPortalDomain, getTenantFromHost } from "./lib/tenant-host";
import { deletionHeaders, isSessionOnlyExpired, isSessionTokenCookie } from "./lib/auth/sessionPersistence";
import { resolveWorkspaceUrl } from "./lib/auth/workspaceUrl";

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
  "/api/webhooks",
  "/api/gmail/callback",
  "/api/support",
  "/support",
  "/auth/error",
  "/go",
  "/s",
  "/api/shares",
  "/apply",
  "/f",
  "/preferences",
  "/portal",
  "/api/portal",
  "/tenant-not-found",
  // Legal pages must be readable logged-out: Google's OAuth verification (and
  // anyone following the footer links) fetches them without a session.
  "/privacy",
  "/terms",
  // For search engines (src/app/robots.ts, src/app/sitemap.ts). .txt and .xml
  // aren't in the matcher's static-file exclusions, so they need listing here.
  "/robots.txt",
  "/sitemap.xml"
];

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
  const portal = getPortalDomain();

  // One public address: www.harborops.co.uk → harborops.co.uk. GET/HEAD only,
  // so nothing that posts to www (a webhook, a form) is bounced.
  const hostname = (host ?? "").split(":")[0].toLowerCase();
  if (portal && hostname === `www.${portal}` && (request.method === "GET" || request.method === "HEAD")) {
    return NextResponse.redirect(
      new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, `https://${portal}`),
      308
    );
  }

  const tenantSlug = getTenantFromHost(host);

  // "Keep me signed in" was unticked for this session and the browser has been
  // closed since: sign the request out before Supabase reads (or refreshes) the
  // session. The cookies come off the request here, so server code in this
  // request sees a signed-out visitor, and `finish` deletes them in the browser.
  // See src/lib/auth/sessionPersistence.ts.
  const expiredCookies = isSessionOnlyExpired(request.cookies.getAll())
    ? request.cookies
        .getAll()
        .map((cookie) => cookie.name)
        .filter(isSessionTokenCookie)
    : [];
  for (const name of expiredCookies) request.cookies.delete(name);
  const finish = (res: NextResponse): NextResponse => {
    if (expiredCookies.length > 0) {
      const domain = getSharedCookieDomain();
      const secure = process.env.NODE_ENV === "production";
      // Raw headers, appended last: NextResponse.cookies holds one entry per
      // name, but each cookie can exist twice (shared domain and host-only).
      for (const name of expiredCookies) {
        for (const header of deletionHeaders(name, domain, secure)) res.headers.append("set-cookie", header);
      }
    }
    return res;
  };

  const { supabase, getResponse } = createSupabaseMiddlewareClient(request);
  // Use getSession() here (reads from cookie JWT, no network call unless token needs refresh).
  // Full getUser() validation happens inside requireUserProfile() in each server action/page,
  // so security is maintained where it matters. This avoids hitting Supabase auth rate limits
  // when many agents submit concurrently.
  const {
    data: { session }
  } = await supabase.auth.getSession();
  // Read only now: a token refresh inside getSession() replaces the response.
  const response = getResponse();

  const { pathname } = request.nextUrl;

  // Fallback: if Supabase redirected a ?code to the root instead of /auth/callback,
  // forward it to /auth/callback so the session exchange works correctly.
  const code = request.nextUrl.searchParams.get("code");
  const type = request.nextUrl.searchParams.get("type");
  if (code && pathname === "/") {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    // Preserve an existing `next` param if Supabase passed it through; otherwise
    // derive from `type`.
    const existingNext = request.nextUrl.searchParams.get("next");
    const resolvedNext =
      existingNext ??
      (type === "recovery"
        ? "/reset-password"
        : type === "invite"
        ? "/invite/set-password"
        : "/me");
    callbackUrl.searchParams.set("next", resolvedNext);
    return finish(withAuthCookies(response, NextResponse.redirect(callbackUrl)));
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
      return finish(withAuthCookies(response, NextResponse.rewrite(notFoundUrl, { status: 404 })));
    }

    // If the slug is valid but the signed-in user belongs to a different
    // tenant, send them to their own subdomain rather than letting them browse
    // someone else's workspace shell (RLS would block reads anyway, but the
    // dashboard chrome shouldn't render).
    const sessionUser = session?.user;
    if (sessionUser && process.env.NODE_ENV !== "development") {
      const { tenantId: userTenantId, slug: userSlug } = await getUserTenant(sessionUser.id);
      if (userTenantId && userSlug && userTenantId !== resolvedTenantId && portal) {
        const target = new URL(`https://${userSlug}.${portal}/dashboard`);
        return finish(withAuthCookies(response, NextResponse.redirect(target)));
      }
    }
  }

  const user = session?.user ?? null;

  // Already signed in: the tenant root and /login go straight to the workspace.
  // GET only, so the sign-in action's own POST to /login — and the page
  // re-render it triggers — is never interrupted. Never with ?disabled=1:
  // requireUserProfile sends disabled agents there with the session cookies
  // still in place, and forwarding them on would loop.
  if (
    user &&
    request.method === "GET" &&
    ((tenantSlug && pathname === "/") || pathname === "/login") &&
    !request.nextUrl.searchParams.has("disabled")
  ) {
    const target = await resolveWorkspaceUrl({
      userId: user.id,
      host,
      next: request.nextUrl.searchParams.get("next"),
    });
    return finish(withAuthCookies(response, NextResponse.redirect(new URL(target, request.url))));
  }

  // On tenant subdomains, the root otherwise redirects to login
  if (tenantSlug && pathname === "/") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return finish(withAuthCookies(response, NextResponse.redirect(loginUrl)));
  }

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  const isApiRoute = pathname.startsWith("/api/");
  // Apex-domain landing page: harborops.co.uk/ (no subdomain) renders the
  // marketing page. Tenant subdomain roots are handled above.
  const isApexLanding = !tenantSlug && pathname === "/";

  if (!user && !isPublic && !isApiRoute && !isApexLanding) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    // Preserve the intended destination so login can return the user here
    // (deep links like /landlords/<id> should survive the auth bounce).
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return finish(withAuthCookies(response, NextResponse.redirect(redirectUrl)));
  }

  // Attach tenant slug so server components / API routes can read it via headers().get("x-tenant")
  if (tenantSlug) {
    response.headers.set("x-tenant", tenantSlug);
  }

  // Property share links and the renter portal must never be indexed by crawlers.
  if (
    pathname.startsWith("/s/") ||
    pathname === "/s" ||
    pathname.startsWith("/portal/") ||
    pathname === "/portal"
  ) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return finish(response);
}

export const config = {
  // Skip Next internals and static files served from /public (images, fonts,
  // pdfjs assets, etc.). Without the file-extension exclusion, requests like
  // GET /harbor-logo.png run through the auth gate and get redirected to /login
  // for logged-out visitors — so the logo (and every public asset) fails to
  // load on the auth pages.
  //
  // `monitoring` is the Sentry tunnel (next.config.mjs tunnelRoute). Browser
  // error reports from logged-out pages would otherwise be redirected to /login.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|mjs|map|woff|woff2|ttf|eot|pdf)$).*)"
  ]
};

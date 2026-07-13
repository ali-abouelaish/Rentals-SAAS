import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserTenant } from "@/lib/tenant-slug-cache";

/**
 * Stable, tenant-agnostic deep link to a landlord profile.
 *
 *   GET /go/landlord/<landlord uuid>
 *
 * Built to be shared from external systems (e.g. the scraper / partner apps)
 * that only hold a landlord id — not the tenant's subdomain. The link points at
 * the apex domain; this resolver derives the tenant from the *signed-in user*
 * (not from the landlord) and hands off to that user's own subdomain:
 *
 *   - Signed in  → 302 https://{user-slug}.harborops.co.uk/landlords/<id>
 *   - Signed out → 302 /login?next=/landlords/<id>  (returns here after login)
 *
 * The destination page (`/landlords/[id]`) is tenant-scoped by RLS, so a link to
 * a landlord outside the user's tenant simply won't resolve any data.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  if (!UUID_RE.test(id)) {
    // Unknown/garbage id — bounce to the generic not-found rather than leak.
    return NextResponse.redirect(new URL("/tenant-not-found", request.url));
  }

  const dest = `/landlords/${id}`;

  const supabase = createSupabaseServerClient();
  // getSession reads the cookie JWT (no network call in the common case); the
  // destination page re-validates with getUser via requireUserProfile().
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Not signed in → send to login, preserving the destination so they land on
  // the landlord profile once authenticated (see signInWithEmail).
  if (!session?.user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", dest);
    return NextResponse.redirect(loginUrl);
  }

  // Signed in → resolve the user's own tenant subdomain and hand off.
  const { slug } = await getUserTenant(session.user.id);

  const portalRaw = process.env.APP_PORTAL_DOMAIN;
  const portal = portalRaw
    ? portalRaw.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase()
    : null;

  if (process.env.NODE_ENV === "production" && slug && portal) {
    return NextResponse.redirect(new URL(dest, `https://${slug}.${portal}`));
  }

  // Dev, no portal domain, or a super admin without a tenant slug: stay on the
  // current origin.
  return NextResponse.redirect(new URL(dest, request.url));
}

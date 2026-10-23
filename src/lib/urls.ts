import { headers } from "next/headers";

type RequestHeaders = ReturnType<typeof headers>;

/**
 * Build a tenant-aware base URL for links shared from inside the app (e.g. the
 * public booking form). The admin is always on `{slug}.harborops.co.uk` when
 * they trigger a share, so the request's host already carries the correct
 * subdomain — prefer it over the static NEXT_PUBLIC_APP_URL, which points at
 * the apex domain.
 */
export function buildTenantAppUrl(h: RequestHeaders): string {
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");

  if (host) {
    return `${proto}://${host}`;
  }

  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

/**
 * Base URL to give external developers for the public API (/api/public/*).
 *
 * The apex domain, not the tenant's subdomain: the API key alone decides
 * which agency a request belongs to; a subdomain request costs the middleware
 * a slug lookup, and a Supabase blip there 404s it to /tenant-not-found (the
 * enquiry is lost); and a super admin can rename a slug, which would break
 * every URL already pasted into an agency's website. Off production, or with
 * no portal domain set, it falls back to the request's own host so local
 * snippets point at localhost. Never NEXT_PUBLIC_APP_URL — that is frozen in at
 * build time.
 */
export function buildPublicApiBaseUrl(h: RequestHeaders): string {
  const portal = (process.env.APP_PORTAL_DOMAIN ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();
  if (process.env.NODE_ENV === "production" && portal) {
    return `https://${portal}`;
  }
  return buildTenantAppUrl(h);
}

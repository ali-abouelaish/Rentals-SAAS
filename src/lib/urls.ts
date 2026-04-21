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

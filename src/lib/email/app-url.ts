import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Build absolute links for emails that resolve to the recipient's own tenant
 * subdomain (e.g. https://acme.harborops.co.uk/rentals/x).
 *
 * Why not just use NEXT_PUBLIC_APP_URL: Next.js inlines every `NEXT_PUBLIC_*`
 * reference at *build* time, so whatever value was present when the server
 * bundle was built is frozen in — a build done with a localhost value ships
 * localhost links forever. APP_PORTAL_DOMAIN is a server-only var read at
 * runtime, so it can't be baked in, and combining it with the tenant slug also
 * points the link at the correct workspace instead of the apex domain.
 */

function portalDomain(): string | null {
  const raw = process.env.APP_PORTAL_DOMAIN;
  if (!raw) return null;
  const cleaned = raw.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
  return cleaned || null;
}

function fallbackBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://harborops.co.uk").replace(/\/$/, "");
}

/**
 * Build an absolute URL on the tenant's subdomain. Falls back to the flat app
 * URL when the portal domain or slug is unavailable.
 */
export function tenantAppUrl(slug: string | null | undefined, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const portal = portalDomain();
  if (portal && slug) return `https://${slug}.${portal}${p}`;
  return `${fallbackBase()}${p}`;
}

const TTL_MS = 60_000;
const slugCache = new Map<string, { slug: string | null; expiresAt: number }>();

async function getTenantSlug(tenantId: string): Promise<string | null> {
  const now = Date.now();
  const hit = slugCache.get(tenantId);
  if (hit && hit.expiresAt > now) return hit.slug;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("slug")
    .eq("id", tenantId)
    .maybeSingle();
  const slug = (data?.slug as string | null) ?? null;
  slugCache.set(tenantId, { slug, expiresAt: now + TTL_MS });
  return slug;
}

/** Resolve a tenant's subdomain link for `path` from its id. */
export async function getTenantAppUrl(tenantId: string, path: string): Promise<string> {
  const slug = await getTenantSlug(tenantId);
  return tenantAppUrl(slug, path);
}

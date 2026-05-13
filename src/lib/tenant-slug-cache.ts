/**
 * Edge-runtime-safe tenant slug validation for middleware.
 *
 * Resolves a slug from the host header to a tenant_id by querying PostgREST
 * directly with the service role key. Results are cached in a module-scope
 * Map (per Edge instance) for 60s to keep the per-request overhead negligible.
 *
 * Used by middleware to:
 *  - Return 404 for unknown subdomains (typos like `truehlod.harborops.co.uk`).
 *  - Redirect logged-in users whose session belongs to a different tenant to
 *    their own subdomain.
 */

const TTL_MS = 60_000;

type SlugEntry = { tenantId: string | null; expiresAt: number };
type UserEntry = { tenantId: string | null; slug: string | null; expiresAt: number };

const slugToTenant = new Map<string, SlugEntry>();
const userToTenant = new Map<string, UserEntry>();

function restUrl(path: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/rest/v1${path}`;
}

function restHeaders(): Record<string, string> | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return { apikey: key, Authorization: `Bearer ${key}` };
}

export async function getTenantIdBySlug(slug: string): Promise<string | null> {
  const now = Date.now();
  const cached = slugToTenant.get(slug);
  if (cached && cached.expiresAt > now) return cached.tenantId;

  const url = restUrl(`/tenants?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`);
  const headers = restHeaders();
  if (!url || !headers) return null;

  try {
    const resp = await fetch(url, { headers, cache: "no-store" });
    if (!resp.ok) return null;
    const rows = (await resp.json()) as Array<{ id: string }>;
    const tenantId = rows[0]?.id ?? null;
    slugToTenant.set(slug, { tenantId, expiresAt: now + TTL_MS });
    return tenantId;
  } catch {
    return null;
  }
}

export async function getUserTenant(userId: string): Promise<{ tenantId: string | null; slug: string | null }> {
  const now = Date.now();
  const cached = userToTenant.get(userId);
  if (cached && cached.expiresAt > now) {
    return { tenantId: cached.tenantId, slug: cached.slug };
  }

  const url = restUrl(
    `/user_profiles?id=eq.${encodeURIComponent(userId)}&select=tenant_id,role,tenants(slug)&limit=1`
  );
  const headers = restHeaders();
  if (!url || !headers) return { tenantId: null, slug: null };

  try {
    const resp = await fetch(url, { headers, cache: "no-store" });
    if (!resp.ok) return { tenantId: null, slug: null };
    const rows = (await resp.json()) as Array<{
      tenant_id: string | null;
      role: string | null;
      tenants: { slug: string | null } | { slug: string | null }[] | null;
    }>;
    const row = rows[0];
    const tenantsField = row?.tenants;
    const slug = Array.isArray(tenantsField)
      ? tenantsField[0]?.slug ?? null
      : tenantsField?.slug ?? null;
    const tenantId = row?.tenant_id ?? null;
    // Super admins are not tied to a tenant subdomain; treat them as having no slug
    // so they aren't redirected when inspecting tenant subdomains.
    const role = (row?.role ?? "").toLowerCase();
    const effectiveSlug = role === "super_admin" ? null : slug;
    const effectiveTenantId = role === "super_admin" ? null : tenantId;
    userToTenant.set(userId, {
      tenantId: effectiveTenantId,
      slug: effectiveSlug,
      expiresAt: now + TTL_MS,
    });
    return { tenantId: effectiveTenantId, slug: effectiveSlug };
  } catch {
    return { tenantId: null, slug: null };
  }
}

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Build the post-OAuth redirect back to the agency's Email Sending settings.
 *
 * In production each agency is on its own subdomain ({slug}.APP_PORTAL_DOMAIN),
 * but the OAuth callback lands on a single fixed host — so we must send the
 * browser back to the tenant's own subdomain, where its session cookie lives.
 * In development (single localhost host) we fall back to NEXT_PUBLIC_APP_URL.
 */
export async function buildEmailSettingsUrl(
  tenantId: string,
  params: Record<string, string>,
): Promise<string> {
  const base = await resolveTenantBase(tenantId);
  const url = new URL(`${base}/settings/email`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** Redirect target when we can't resolve a tenant (e.g. invalid state). */
export function fallbackEmailSettingsUrl(params: Record<string, string>): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const url = new URL(`${base}/settings/email`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

async function resolveTenantBase(tenantId: string): Promise<string> {
  const portalRaw = process.env.APP_PORTAL_DOMAIN;
  const portal = portalRaw
    ? portalRaw.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase()
    : null;

  // Only build a subdomain URL in production; in dev everything is on
  // NEXT_PUBLIC_APP_URL (localhost) even though APP_PORTAL_DOMAIN is set.
  if (process.env.NODE_ENV === "production" && portal) {
    const admin = createSupabaseAdminClient();
    const { data } = await admin.from("tenants").select("slug").eq("id", tenantId).maybeSingle();
    const slug = (data?.slug as string | null) ?? null;
    if (slug) return `https://${slug}.${portal}`;
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? "";
}

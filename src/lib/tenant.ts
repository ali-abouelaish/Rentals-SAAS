import { cache } from "react";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTenantFromHost } from "@/lib/tenant-host";

// The host → slug logic lives in tenant-host.ts so middleware (Edge) can share it.
export { getTenantFromHost } from "@/lib/tenant-host";

export interface TenantBrandingForMetadata {
  tenantId: string;
  name: string;
  brandName: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

/**
 * Look up the current request's tenant (via Host header) along with branding
 * fields needed to render link previews (OG/Twitter cards, favicon).
 *
 * Returns null on the apex domain or when the slug doesn't match a tenant.
 * Safe to call from server components / generateMetadata — uses the admin
 * client because this runs for unauthenticated visitors (e.g. social bots).
 * Cached per request: the root metadata and the sign-in door both ask.
 */
export const getTenantBrandingByHost = cache(async (): Promise<TenantBrandingForMetadata | null> => {
  const host = headers().get("host");
  if (!host) return null;

  const slug = getTenantFromHost(host);
  if (!slug) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("tenants")
    .select("id, name, branding:tenant_branding_settings(brand_name, logo_url, primary_color)")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;

  const branding = Array.isArray(data.branding) ? data.branding[0] : data.branding;

  return {
    tenantId: data.id as string,
    name: data.name as string,
    brandName: (branding?.brand_name as string | undefined) ?? (data.name as string),
    logoUrl: (branding?.logo_url as string | undefined) ?? null,
    primaryColor: (branding?.primary_color as string | undefined) ?? null,
  };
});


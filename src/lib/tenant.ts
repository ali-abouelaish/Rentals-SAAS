import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Derive the tenant slug from a host name.
 *
 * Examples:
 * - "truehold.harborops.co.uk" -> "truehold"
 * - "www.harborops.co.uk"      -> null
 * - "harborops.co.uk"          -> null
 */
export function getTenantFromHost(host: string): string | null {
  const hostname = host.split(":")[0].toLowerCase();
  const parts = hostname.split(".");

  if (parts.length > 2) {
    const [first] = parts;
    if (first && first !== "www") {
      return first;
    }
  }

  return null;
}

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
 */
export async function getTenantBrandingByHost(): Promise<TenantBrandingForMetadata | null> {
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
}


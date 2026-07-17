import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPortalSession, type PortalSession } from "@/lib/portal/session";
import type { TenantBrandingSettings } from "@/features/admin/domain/types";

export type ResolvedPortalTenant = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  alertPhone: string | null;
  branding: TenantBrandingSettings | null;
};

function getSlugFromRequest(request: NextRequest): string | null {
  const headerSlug = request.headers.get("x-tenant");
  if (headerSlug) return headerSlug;

  const host = request.headers.get("host");
  const hostname = host?.split(":")[0].toLowerCase() ?? "";
  if (hostname === "localhost" || hostname.startsWith("127.")) {
    return request.nextUrl.searchParams.get("companySlug");
  }
  return null;
}

function getSlugFromServerHeaders(): string | null {
  const h = headers();
  return h.get("x-tenant");
}

/** Default-ON entitlement check, mirroring getEntitlements() semantics but
 *  usable without a staff profile (the portal has no signed-in user). */
async function isPortalEnabled(tenantId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("tenant_feature_entitlements")
    .select("is_enabled, ends_on")
    .eq("tenant_id", tenantId)
    .eq("feature_key", "tenant_portal")
    .maybeSingle();

  if (!data) return true;
  const today = new Date().toISOString().slice(0, 10);
  return Boolean(data.is_enabled) && (!data.ends_on || data.ends_on >= today);
}

async function fetchBySlug(slug: string): Promise<ResolvedPortalTenant | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("tenants")
    .select(
      `id, name, slug, contact_email, alert_phone,
       branding:tenant_branding_settings(
         tenant_id, brand_name, logo_url, primary_color, secondary_color,
         accent_color, theme_mode, font_family, updated_at
       )`
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return null;
  if (!(await isPortalEnabled(data.id))) return null;

  const branding = Array.isArray(data.branding) ? data.branding[0] : data.branding;

  return {
    id: data.id as string,
    name: data.name as string,
    slug: data.slug as string,
    contactEmail: data.contact_email as string,
    alertPhone: (data.alert_phone as string | null) ?? null,
    branding: (branding as TenantBrandingSettings | null) ?? null,
  };
}

/** Resolve the agency for a portal page (server component). Returns null for
 *  unknown slugs and for agencies with the tenant_portal feature disabled. */
export async function resolvePortalTenant(
  searchSlug?: string | null
): Promise<ResolvedPortalTenant | null> {
  const slug = getSlugFromServerHeaders() ?? searchSlug ?? null;
  if (!slug) return null;
  return fetchBySlug(slug);
}

/** Same as resolvePortalTenant but for route handlers. */
export async function resolvePortalTenantFromRequest(
  request: NextRequest
): Promise<ResolvedPortalTenant | null> {
  const slug = getSlugFromRequest(request);
  if (!slug) return null;
  return fetchBySlug(slug);
}

export type PortalContext = {
  tenant: ResolvedPortalTenant;
  session: PortalSession;
};

/**
 * Resolve tenant + verify the renter session belongs to it. The cross-check
 * matters on localhost, where the host-only cookie can't isolate slugs — a
 * session minted for agency A must never render agency B's data.
 */
export async function requirePortalContext(
  searchSlug?: string | null
): Promise<PortalContext | null> {
  const tenant = await resolvePortalTenant(searchSlug);
  if (!tenant) return null;
  const session = getPortalSession();
  if (!session || session.tenantId !== tenant.id) return null;
  return { tenant, session };
}

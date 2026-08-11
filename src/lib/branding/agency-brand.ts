/**
 * Resolve an agency's brand for documents (statement PDFs and the like).
 *
 * There are two branding stores in this codebase and they are not kept in sync:
 *
 *   tenant_branding_settings  — the LIVE one. It is what the super-admin
 *                               branding screen writes, what the app shell
 *                               renders, and what the renter portal and public
 *                               forms use. Logos are uploaded to a public
 *                               bucket, so logo_url is a fetchable URL.
 *   tenants.branding (jsonb)  — the older store, read by the email layer
 *                               (loadAgency / normalizeBranding). For most
 *                               tenants it is empty, so callers silently fall
 *                               back to Harbor Ops defaults.
 *
 * Documents read the live store first and fall back to the jsonb one, so an
 * agency that branded itself through the admin screen actually sees its own
 * logo and colours. `footer_address` and `reply_to_email` only exist on the
 * jsonb store, so those still come from there.
 *
 * NOTE: outbound email still reads tenants.branding directly and therefore has
 * the same blind spot. Migrating it is a separate, wider change.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_BRANDING, normalizeBranding, type AgencyBranding } from "@/lib/email/branding";

export type AgencyBrand = {
  tenantId: string;
  /** Brand name if set, else the tenant's own name. What documents display. */
  displayName: string;
  branding: AgencyBranding;
  /** Secondary colour — only the live store has one; used for accents. */
  secondaryColor: string | null;
};

/** A colour react-pdf will accept (it throws on anything malformed). */
function validHex(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : null;
}

/**
 * react-pdf fetches images over HTTP and cannot resolve a relative path or a
 * bare storage key, so anything that isn't absolute is dropped rather than
 * left to blow up mid-render.
 */
function usableLogo(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v : null;
}

export async function loadAgencyBrand(tenantId: string): Promise<AgencyBrand | null> {
  const admin = createSupabaseAdminClient();

  const [{ data: tenant, error }, { data: settings }] = await Promise.all([
    admin.from("tenants").select("id, name, branding").eq("id", tenantId).maybeSingle(),
    admin
      .from("tenant_branding_settings")
      .select("brand_name, logo_url, primary_color, secondary_color, accent_color")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  if (!tenant) return null;

  const legacy = normalizeBranding(tenant.branding);
  const live = (settings ?? null) as {
    brand_name: string | null;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    accent_color: string | null;
  } | null;

  const tenantName = (tenant.name as string) ?? "";

  return {
    tenantId: tenant.id as string,
    displayName:
      live?.brand_name?.trim() ||
      tenantName ||
      legacy.from_display_name ||
      DEFAULT_BRANDING.from_display_name,
    branding: {
      ...legacy,
      logo_url: usableLogo(live?.logo_url) ?? usableLogo(legacy.logo_url),
      primary_color:
        validHex(live?.primary_color) ?? validHex(legacy.primary_color) ?? DEFAULT_BRANDING.primary_color,
      accent_color:
        validHex(live?.accent_color) ?? validHex(legacy.accent_color) ?? DEFAULT_BRANDING.accent_color,
    },
    secondaryColor: validHex(live?.secondary_color),
  };
}

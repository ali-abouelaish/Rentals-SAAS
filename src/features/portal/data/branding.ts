import { cache } from "react";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TenantBrandingSettings } from "@/features/admin/domain/types";

/** Matches --brand-primary / --surface-ground defaults in globals.css. */
const DEFAULT_THEME_COLOR = "#0B2F59";
/** Splash-screen / browser-chrome background for the installed portal. */
export const PORTAL_BACKGROUND_COLOR = "#eef1f6";

// Same guard BrandingStyles applies before interpolating a colour into CSS.
// These values also land in <meta name="theme-color"> and the web manifest, so
// anything that isn't a strict hex falls back to the brand default.
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export type PortalBrandChrome = {
  brandName: string;
  logoUrl: string | null;
  /** Validated hex — safe for <meta name="theme-color"> and the manifest. */
  themeColor: string;
  branding: TenantBrandingSettings | null;
};

const FALLBACK: PortalBrandChrome = {
  brandName: "Tenant portal",
  logoUrl: null,
  themeColor: DEFAULT_THEME_COLOR,
  branding: null,
};

/**
 * Branding for the portal shell — read by the layout (atmosphere + CSS vars),
 * by its viewport/metadata exports (status-bar colour, apple-touch-icon) and by
 * the dynamic web manifest, so the installed app matches the page it came from.
 *
 * Layouts and manifests can't read searchParams, so the dev ?companySlug=
 * fallback isn't available here — on localhost the portal renders with default
 * branding and the pages resolve the tenant themselves.
 *
 * cache()d because generateViewport, generateMetadata and the layout body all
 * want the same row within a single render.
 */
export const getPortalBrandChrome = cache(async function (): Promise<PortalBrandChrome> {
  const slug = headers().get("x-tenant");
  if (!slug) return FALLBACK;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("tenants")
    .select(
      `name,
       branding:tenant_branding_settings(
         tenant_id, brand_name, logo_url, primary_color, secondary_color,
         accent_color, theme_mode, font_family, updated_at
       )`
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return FALLBACK;

  const branding = (
    Array.isArray(data.branding) ? data.branding[0] : data.branding
  ) as TenantBrandingSettings | null;
  const primary = (branding?.primary_color ?? "").trim();

  return {
    brandName: branding?.brand_name?.trim() || (data.name as string),
    logoUrl: branding?.logo_url?.trim() || null,
    themeColor: HEX_COLOR_RE.test(primary) ? primary : DEFAULT_THEME_COLOR,
    branding: branding ?? null,
  };
});

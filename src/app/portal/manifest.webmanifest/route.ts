import { NextResponse } from "next/server";
import type { MetadataRoute } from "next";
import {
  PORTAL_BACKGROUND_COLOR,
  getPortalBrandChrome,
} from "@/features/portal/data/branding";

// The manifest is per-tenant (it reads the x-tenant subdomain header), so it
// can't be generated at build time. This is a plain route handler rather than
// an app/portal/manifest.ts metadata file because Next 14 still tries to
// statically export the latter and fails the build even with force-dynamic.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Fallback icon shipped in /public — dimensions declared honestly so Chrome's
 *  installability check can validate it. */
const FALLBACK_ICON = {
  src: "/logo.png",
  sizes: "796x774",
  type: "image/png",
} as const;

export async function GET() {
  const { brandName, logoUrl, themeColor } = await getPortalBrandChrome();

  const manifest: MetadataRoute.Manifest = {
    id: "/portal",
    name: `${brandName} — Tenant portal`,
    short_name: brandName,
    description: `Rent, deposit protection, maintenance and contact details for your tenancy with ${brandName}.`,
    start_url: "/portal",
    // Deliberately wider than /portal: "Report an issue" bounces through
    // /portal/report into the /support triage chat, and an out-of-scope
    // navigation would kick the renter out of the installed window into a
    // browser tab mid-task.
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: themeColor,
    background_color: PORTAL_BACKGROUND_COLOR,
    icons: logoUrl
      ? [{ src: logoUrl, sizes: "any", purpose: "any" }, FALLBACK_ICON]
      : [FALLBACK_ICON],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      // Every agency subdomain serves a different body from this path — never
      // let a shared proxy hand one tenant's branding to another.
      "Cache-Control": "no-store",
    },
  });
}

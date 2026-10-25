import { headers } from "next/headers";
import { getTenantFromHost } from "@/lib/tenant-host";
import { buildPublicApiBaseUrl } from "@/lib/urls";

// A route handler rather than app/robots.ts: it depends on the host, and a dynamic metadata file
// breaks `next build` on Next 14.2 (see the portal manifest, which works around the same thing).
export const dynamic = "force-dynamic";

/**
 * The public website (the bare domain) is open to search engines and points them at the sitemap.
 * An agency's own subdomain is its workspace (sign-in, renter portal, share links), so nothing
 * there is for search.
 */
export function GET() {
  const h = headers();
  const body = getTenantFromHost(h.get("host"))
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\n\nSitemap: ${buildPublicApiBaseUrl(h)}/sitemap.xml\n`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

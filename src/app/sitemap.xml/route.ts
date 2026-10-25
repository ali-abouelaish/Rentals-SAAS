import { headers } from "next/headers";
import { getTenantFromHost } from "@/lib/tenant-host";
import { buildPublicApiBaseUrl } from "@/lib/urls";

// A route handler rather than app/sitemap.ts: see robots.txt/route.ts.
export const dynamic = "force-dynamic";

/** The public website's pages. Sign-in and the rest of the front door stay out (they're noindex). */
const PAGES = ["/", "/signup", "/privacy", "/terms"];

export function GET() {
  const h = headers();
  if (getTenantFromHost(h.get("host"))) return new Response("Not found", { status: 404 });

  const site = buildPublicApiBaseUrl(h);
  const urls = PAGES.map((path) => `  <url><loc>${site}${path}</loc></url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

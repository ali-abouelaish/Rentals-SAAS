import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildSpareroomSearchUrl } from "@/lib/scrapers/spareroom-search-url";

export const runtime = "nodejs";

const DEFAULT_RADIUS_MILES = 1;

/**
 * GET /api/market/spareroom-search-targets?radius_miles=3
 * Returns SpareRoom search URLs for every distinct postcode across all
 * tenants' properties + in-progress evaluations. Auth: Bearer SCRAPER_API_KEY.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const apiKey = authHeader?.replace(/^Bearer\s+/i, "").trim();
  const expectedKey = process.env.SCRAPER_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const radiusParam = request.nextUrl.searchParams.get("radius_miles");
  const radius_miles = radiusParam ? Math.max(1, Math.min(50, Number(radiusParam))) : DEFAULT_RADIUS_MILES;

  const supabase = createSupabaseAdminClient();

  const [propertiesRes, evaluationsRes] = await Promise.all([
    supabase.from("properties").select("postcode").not("postcode", "is", null),
    supabase.from("evaluations").select("postcode").not("postcode", "is", null),
  ]);

  if (propertiesRes.error) {
    return NextResponse.json({ error: propertiesRes.error.message }, { status: 500 });
  }
  if (evaluationsRes.error) {
    return NextResponse.json({ error: evaluationsRes.error.message }, { status: 500 });
  }

  const distinct = new Set<string>();
  for (const row of propertiesRes.data ?? []) {
    const pc = normalizePostcode(row.postcode);
    if (pc) distinct.add(pc);
  }
  for (const row of evaluationsRes.data ?? []) {
    const pc = normalizePostcode(row.postcode);
    if (pc) distinct.add(pc);
  }

  const searches = Array.from(distinct).map((postcode) => ({
    postcode,
    radius_miles,
    url: buildSpareroomSearchUrl(postcode, { radius_miles }),
  }));

  return NextResponse.json({ searches });
}

function normalizePostcode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.toString().trim().toUpperCase().replace(/\s+/g, " ");
  return cleaned.length >= 2 ? cleaned : null;
}

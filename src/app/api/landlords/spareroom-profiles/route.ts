import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/landlords/spareroom-profiles?tenant_id=<uuid>
 * Returns landlord SpareRoom profile URLs for the scraper.
 * Requires: Authorization: Bearer <SCRAPER_API_KEY> and SCRAPER_API_KEY in env.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const apiKey = authHeader?.replace(/^Bearer\s+/i, "").trim();
  const expectedKey = process.env.SCRAPER_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  if (!tenantId) {
    return NextResponse.json(
      { error: "Missing tenant_id query parameter" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: landlords, error } = await supabase
    .from("landlords")
    .select("id, name, spareroom_profile_url, pays_commission, profile_notes")
    .eq("tenant_id", tenantId)
    .not("spareroom_profile_url", "is", null)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const profiles = (landlords ?? []).map((l) => ({
    url: l.spareroom_profile_url,
    paying: l.pays_commission ? "yes" : "no",
    name: l.name ?? "",
    id: l.id,
  }));

  return NextResponse.json({
    profiles: profiles.map((p) => p.url),
    paying_flags: profiles.map((p) => p.paying),
    profile_flags: profiles.map(() => ""), // profile notes are not flags; flags are set manually
    names: profiles.map((p) => p.name),
    ids: profiles.map((p) => p.id),
  });
}

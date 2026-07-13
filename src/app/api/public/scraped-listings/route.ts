import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyPublicApiKey } from "@/lib/api-keys/verify";

const REQUIRED_SCOPE = "scraped_listings:read";

const SORTABLE_COLUMNS = new Set([
  "created_at",
  "updated_at",
  "price",
  "available_date",
  "min_room_price_pcm",
  "max_room_price_pcm",
]);

export async function GET(request: NextRequest) {
  const auth = await verifyPublicApiKey(request.headers);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.scopes.includes(REQUIRED_SCOPE)) {
    return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;

  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "50", 10) || 50, 1), 200);
  const offset = Math.max(parseInt(sp.get("offset") ?? "0", 10) || 0, 0);

  // sort=column.direction (default created_at.desc)
  const sortRaw = sp.get("sort") ?? "created_at.desc";
  const [sortCol, sortDir] = sortRaw.split(".");
  const orderColumn = SORTABLE_COLUMNS.has(sortCol) ? sortCol : "created_at";
  const ascending = sortDir === "asc";

  const supabase = createSupabaseAdminClient();

  // Apply the same filter set to any query builder so the row query and the
  // distinct-landlord query stay in sync.
  type Q = ReturnType<typeof supabase.from<"scraped_listings", never>>["select"] extends (...a: never[]) => infer R ? R : never;
  const applyFilters = <T extends { eq: Function; gte: Function; lte: Function; ilike: Function }>(q: T): T => {
    let qq: any = q.eq("tenant_id", auth.tenant_id);
    const status = sp.get("status");
    if (status) qq = qq.eq("status", status);
    const landlordId = sp.get("landlord_id");
    if (landlordId) qq = qq.eq("landlord_id", landlordId);
    const propertyType = sp.get("property_type");
    if (propertyType) qq = qq.eq("property_type", propertyType);
    const paying = sp.get("paying");
    if (paying) qq = qq.eq("paying", paying);
    const minPrice = sp.get("min_price");
    if (minPrice && !Number.isNaN(Number(minPrice))) qq = qq.gte("price", Number(minPrice));
    const maxPrice = sp.get("max_price");
    if (maxPrice && !Number.isNaN(Number(maxPrice))) qq = qq.lte("price", Number(maxPrice));
    const location = sp.get("location");
    if (location) qq = qq.ilike("location", `%${location}%`);
    const availableFrom = sp.get("available_from");
    if (availableFrom && /^\d{4}-\d{2}-\d{2}$/.test(availableFrom)) {
      qq = qq.gte("available_date", availableFrom);
    }
    return qq as T;
  };

  const rowsQuery = applyFilters(
    supabase
      .from("scraped_listings")
      .select("*, landlord:landlords(name)", { count: "exact" })
  )
    .order(orderColumn, { ascending })
    .range(offset, offset + limit - 1);

  // Pull landlord_ids matching the same filters so we can count distinct landlords.
  // Capped at 10k IDs — far above any realistic per-tenant landlord roster.
  const landlordIdsQuery = applyFilters(supabase.from("scraped_listings").select("landlord_id"))
    .not("landlord_id", "is", null)
    .range(0, 9999);

  const [{ data, count, error }, { data: landlordRows, error: landlordErr }] = await Promise.all([
    rowsQuery,
    landlordIdsQuery,
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (landlordErr) {
    return NextResponse.json({ error: landlordErr.message }, { status: 500 });
  }

  const distinctLandlords = new Set(
    (landlordRows ?? [])
      .map((r) => r.landlord_id)
      .filter((id): id is string => Boolean(id))
  );

  // Flatten the embedded landlord relation into a top-level `landlord_name` so
  // the row shape stays flat for consumers.
  const rows = ((data ?? []) as any[]).map((row) => {
    const { landlord, ...rest } = row;
    const rel = Array.isArray(landlord) ? landlord[0] : landlord;
    return { ...rest, landlord_name: rel?.name ?? null };
  });

  return NextResponse.json({
    data: rows,
    pagination: {
      limit,
      offset,
      total: count ?? 0,
      has_more: (count ?? 0) > offset + (data?.length ?? 0),
    },
    landlord_count: distinctLandlords.size,
  });
}

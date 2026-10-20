import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MAP_POINT_COLUMNS, toListingMapPoint } from "@/features/landlords/domain/map-points";
import type { ListingMapPoint } from "@/features/landlords/domain/types";

const PAGE_SIZE = 10;

/** Freshest first, so if the cap ever bites it is the stalest pins that drop. */
const MAP_POINT_LIMIT = 2000;

export async function getLandlords({
  search,
  paying,
  page = 1
}: {
  search?: string;
  paying?: string;
  page?: number;
} = {}) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("landlords")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,contact.ilike.%${search}%,email.ilike.%${search}%`
    );
  }
  if (paying && paying !== "all") {
    query = query.eq("pays_commission", paying === "yes");
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    landlords: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export type ListingMapData = {
  points: ListingMapPoint[];
  /** Listings that match the filters but have no usable coordinates. */
  unlocatedCount: number;
  truncated: boolean;
  error: string | null;
};

/**
 * Every listing for the landlords map, across all list pages. Filtered through
 * the landlords join with the same search and paying filters as getLandlords,
 * so the map always shows the landlords the list does — plus the map's own
 * listing filters (budget, double occupancy), which have no list equivalent.
 *
 * Returns the error rather than throwing: the map is a secondary panel, and a
 * failed map query must not take the landlord list down with it.
 */
export async function getListingMapPoints({
  search,
  paying,
  budget = null,
  double = false,
}: {
  search?: string;
  paying?: string;
  /** Max £ pcm. Same rule as the public API's max_price: unpriced listings drop out. */
  budget?: number | null;
  /** Only listings that accept a couple. */
  double?: boolean;
} = {}): Promise<ListingMapData> {
  const supabase = createSupabaseServerClient();

  const filtered = (columns: string, options?: { count: "exact"; head: true }) => {
    let query = supabase.from("scraped_listings").select(columns, options);
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,contact.ilike.%${search}%,email.ilike.%${search}%`,
        { referencedTable: "landlords" }
      );
    }
    if (paying && paying !== "all") {
      query = query.eq("landlords.pays_commission", paying === "yes");
    }
    if (budget !== null) {
      query = query.lte("price", budget);
    }
    if (double) {
      // couples_ok is free text: SpareRoom's "Couples OK?" gives Yes/No, a
      // spreadsheet may give Y or a TRUE checkbox. Blank means unknown, and an
      // unknown can't be promised to a couple, so it is excluded.
      query = query.filter("couples_ok", "imatch", "^\\s*(y|true)");
    }
    return query;
  };

  const [located, unlocated] = await Promise.all([
    filtered(`${MAP_POINT_COLUMNS}, landlords!inner(name)`)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(MAP_POINT_LIMIT),
    filtered("id, landlords!inner(id)", { count: "exact", head: true }).or(
      "latitude.is.null,longitude.is.null"
    ),
  ]);

  const error = located.error ?? unlocated.error;
  if (error) {
    return { points: [], unlocatedCount: 0, truncated: false, error: error.message };
  }

  const rows = (located.data ?? []) as unknown as Array<
    Parameters<typeof toListingMapPoint>[0] & {
      landlords: { name: string | null } | null;
    }
  >;
  const points: ListingMapPoint[] = [];
  let unusable = 0;
  for (const row of rows) {
    const point = toListingMapPoint(row, row.landlords);
    if (point) points.push(point);
    else unusable += 1;
  }

  return {
    points,
    unlocatedCount: (unlocated.count ?? 0) + unusable,
    truncated: rows.length === MAP_POINT_LIMIT,
    error: null,
  };
}

export async function getLandlordById(id: string) {
  const supabase = createSupabaseServerClient();
  // maybeSingle, not single: a landlord in another tenant is filtered out by RLS
  // and must read as "not found", not as a query error.
  const { data: landlord, error } = await supabase
    .from("landlords")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!landlord) return null;

  const { data: rentals } = await supabase
    .from("rental_codes")
    .select("id")
    .eq("landlord_id", id);

  const { data: listingsScraped } = await supabase
    .from("listings_scraped")
    .select("*")
    .eq("landlord_id", id)
    .order("last_seen_at", { ascending: false });

  // Newest-confirmed first, so anything that has gone stale sinks to the bottom
  // of the table. nullsFirst: false keeps rows predating freshness tracking (no
  // last_seen_at) at the end rather than leading, which is where they belong.
  const { data: scrapedListings } = await supabase
    .from("scraped_listings")
    .select("*")
    .eq("landlord_id", id)
    .order("last_seen_at", { ascending: false, nullsFirst: false });

  // Recent spreadsheet-import history, for the spreadsheet panel. Absent for
  // landlords who have never had a sheet attached.
  const { data: sheetRuns } = await supabase
    .from("landlord_sheet_runs")
    .select("*")
    .eq("landlord_id", id)
    .order("started_at", { ascending: false })
    .limit(5);

  const all = scrapedListings ?? [];

  return {
    landlord,
    rentalsCount: rentals?.length ?? 0,
    listings: listingsScraped ?? [],
    scrapedListings: all,
    sheetRuns: sheetRuns ?? [],
    sheetListingCount: all.filter((row) => row.source === "spreadsheet").length,
  };
}

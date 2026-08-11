import { createSupabaseServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 10;

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

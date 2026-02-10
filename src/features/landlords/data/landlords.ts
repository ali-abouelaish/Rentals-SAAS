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
  const { data: landlord, error } = await supabase
    .from("landlords")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);

  const { data: rentals } = await supabase
    .from("rental_codes")
    .select("id")
    .eq("landlord_id", id);

  const { data: listings } = await supabase
    .from("listings_scraped")
    .select("*")
    .eq("landlord_id", id)
    .order("last_seen_at", { ascending: false });

  return {
    landlord,
    rentalsCount: rentals?.length ?? 0,
    listings: listings ?? []
  };
}

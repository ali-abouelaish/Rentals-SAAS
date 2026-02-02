import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getLandlords({
  search,
  paying
}: {
  search?: string;
  paying?: string;
} = {}) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("landlords")
    .select("*")
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,contact.ilike.%${search}%,email.ilike.%${search}%`
    );
  }
  if (paying && paying !== "all") {
    query = query.eq("pays_commission", paying === "yes");
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
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

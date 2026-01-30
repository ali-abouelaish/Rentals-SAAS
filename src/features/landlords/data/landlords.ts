import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getLandlords() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("landlords")
    .select("*")
    .order("created_at", { ascending: false });
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

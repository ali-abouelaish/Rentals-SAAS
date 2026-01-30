import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getRentalCodes({
  search,
  status
}: {
  search?: string;
  status?: string;
}) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("rental_codes")
    .select("id, code, status, created_at, payment_method, consultation_fee_amount, client_snapshot, clients(full_name, phone)")
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`code.ilike.%${search}%,client_snapshot->>full_name.ilike.%${search}%`);
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRentalCodeById(id: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("rental_codes")
    .select("*, clients(full_name, phone), user_profiles!rental_codes_assisted_by_agent_id_fkey(display_name)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

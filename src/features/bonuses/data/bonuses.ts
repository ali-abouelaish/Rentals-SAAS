import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getBonuses({
  status,
  search,
  landlordId
}: {
  status?: string;
  search?: string;
  landlordId?: string;
} = {}) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("bonuses")
    .select(
      "id, code, bonus_date, client_name, property_address, amount_owed, payout_mode, status, landlord_id, agent_id, notes, landlords:landlords!bonuses_landlord_id_fkey(name), agent:user_profiles!bonuses_agent_id_fkey(display_name)"
    )
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `code.ilike.%${search}%,client_name.ilike.%${search}%,property_address.ilike.%${search}%,landlords.name.ilike.%${search}%`
    );
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (landlordId && landlordId !== "all") {
    query = query.eq("landlord_id", landlordId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

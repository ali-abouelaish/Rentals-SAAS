import { createSupabaseServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 10;

export async function getBonuses({
  status,
  search,
  landlordId,
  page = 1,
}: {
  status?: string;
  search?: string;
  landlordId?: string;
  page?: number;
} = {}) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("bonuses")
    .select(
      "id, code, bonus_date, client_name, property_address, amount_owed, payout_mode, status, landlord_id, agent_id, notes, landlords:landlords!bonuses_landlord_id_fkey(name), agent:user_profiles!bonuses_agent_id_fkey(display_name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `code.ilike.%${search}%,client_name.ilike.%${search}%,property_address.ilike.%${search}%`
    );
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (landlordId && landlordId !== "all") {
    query = query.eq("landlord_id", landlordId);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    bonuses: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

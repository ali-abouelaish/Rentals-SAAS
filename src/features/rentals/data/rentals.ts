import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getRentalCodes({
  search,
  status,
  page = 1
}: {
  search?: string;
  status?: string;
  page?: number;
}) {
  const supabase = createSupabaseServerClient();
  const pageSize = 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("rental_codes")
    .select(
      "id, code, status, created_at, payment_method, consultation_fee_amount, assisted_by_agent_id, clients!rental_codes_client_id_fkey(full_name, phone), user_profiles!rental_codes_assisted_by_agent_id_fkey(display_name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (search) {
    // Search by code OR by client name (two-step: find matching client IDs first)
    const { data: matchingClients } = await supabase
      .from("clients")
      .select("id")
      .ilike("full_name", `%${search}%`);
    const clientIds = (matchingClients ?? []).map((c) => c.id);
    if (clientIds.length > 0) {
      query = query.or(`code.ilike.%${search}%,client_id.in.(${clientIds.join(",")})`);
    } else {
      query = query.ilike("code", `%${search}%`);
    }
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    rentals: data ?? [],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}

export async function getRentalCodeById(id: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("rental_codes")
    .select("*, clients!rental_codes_client_id_fkey(full_name, phone, nationality, dob, occupation, company_or_university_name), user_profiles!rental_codes_assisted_by_agent_id_fkey(display_name)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

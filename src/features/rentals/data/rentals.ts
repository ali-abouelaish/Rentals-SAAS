import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getRentalCodes({
  search,
  status,
  agentId,
  paymentMethod,
  dateFrom,
  dateTo,
  page = 1
}: {
  search?: string;
  status?: string;
  agentId?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}) {
  const supabase = createSupabaseServerClient();
  const pageSize = 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("rental_codes")
    .select(
      "id, code, status, created_at, payment_method, consultation_fee_amount, client_snapshot, assisted_by_agent_id, clients!rental_codes_client_id_fkey(first_name, last_name, full_name, phone), user_profiles!rental_codes_assisted_by_agent_id_fkey(display_name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`code.ilike.%${search}%,client_snapshot->>full_name.ilike.%${search}%`);
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (agentId) {
    query = query.or(`assisted_by_agent_id.eq.${agentId},marketing_agent_id.eq.${agentId}`);
  }
  if (paymentMethod && paymentMethod !== "all") {
    query = query.eq("payment_method", paymentMethod);
  }
  if (dateFrom) {
    query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
  }
  if (dateTo) {
    query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);
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
    .select("*, clients!rental_codes_client_id_fkey(first_name, last_name, full_name, phone, nationality, dob, occupation, company_or_university_name), user_profiles!rental_codes_assisted_by_agent_id_fkey(display_name)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

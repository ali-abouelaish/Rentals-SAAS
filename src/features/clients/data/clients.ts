import { createSupabaseServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 10;

export async function getClients({
  search,
  status,
  page = 1
}: {
  search?: string;
  status?: string;
  page?: number;
}) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("clients")
    .select("*, assigned_agent:user_profiles!assigned_agent_id(display_name)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    clients: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  };
}

export async function getClientById(id: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

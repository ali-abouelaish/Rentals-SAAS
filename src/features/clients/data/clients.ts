import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getClients({
  search,
  status
}: {
  search?: string;
  status?: string;
}) {
  const supabase = createSupabaseServerClient();
  let query = supabase.from("clients").select("*").order("created_at", { ascending: false });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getClientById(id: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

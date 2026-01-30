import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getBonuses(status?: string) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("bonuses")
    .select("*, landlords(name)")
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

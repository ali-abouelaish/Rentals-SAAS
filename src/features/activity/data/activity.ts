import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getRecentActivity(limit = 10) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAgents() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_profiles")
    .select("*, user_profiles(display_name, role)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAgentById(id: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_profiles")
    .select("*, user_profiles(display_name, role)")
    .eq("user_id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

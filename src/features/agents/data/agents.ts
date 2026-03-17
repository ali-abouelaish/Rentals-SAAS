import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAgents({
  search,
  role
}: {
  search?: string;
  role?: string;
} = {}) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("agent_profiles")
    .select("*, user_profiles(display_name, role)")
    .eq("is_disabled", false)
    .order("created_at", { ascending: false });

  if (role && role !== "all") {
    query = query.eq("user_profiles.role", role);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const agents = data ?? [];
  if (!search) return agents;

  const term = search.toLowerCase();
  return agents.filter((a) => {
    const name = (a.user_profiles as { display_name?: string } | null)?.display_name ?? "";
    return name.toLowerCase().includes(term);
  });
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

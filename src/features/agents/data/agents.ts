import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AgentStatusFilter = "active" | "disabled" | "all";

export async function getAgents({
  search,
  role,
  status = "active"
}: {
  search?: string;
  role?: string;
  status?: AgentStatusFilter;
} = {}) {
  const supabase = createSupabaseServerClient();

  // Inner join on user_profiles enforces tenant scoping: combined with RLS on user_profiles,
  // it excludes any agent_profiles row whose user_profiles.tenant_id is a different tenant.
  let query = supabase
    .from("agent_profiles")
    .select("*, user_profiles!inner(display_name, role)")
    .order("created_at", { ascending: false });

  if (status === "active") {
    query = query.eq("is_disabled", false);
  } else if (status === "disabled") {
    query = query.eq("is_disabled", true);
  }

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

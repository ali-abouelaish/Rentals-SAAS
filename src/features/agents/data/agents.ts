import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";

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

/**
 * The agency's "Deduct VAT from rentals before commission" switch.
 * `available` is false until migration 20261019000003 adds the column — the
 * settings card then shows the switch read-only rather than failing the page.
 */
export async function getCommissionVatSetting(): Promise<{ enabled: boolean; available: boolean }> {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("commission_vat_enabled")
    .eq("id", profile.tenant_id)
    .maybeSingle();
  if (error || !data) return { enabled: true, available: false };
  return { enabled: data.commission_vat_enabled !== false, available: true };
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type TeamMemberStatus = "active" | "pending" | "disabled";

export type TeamMember = {
  id: string;
  display_name: string;
  role: string;
  email: string | null;
  status: TeamMemberStatus;
  created_at: string | null;
};

/**
 * Lists the staff accounts that belong to a tenant.
 *
 * `user_profiles` (tenant-scoped via RLS) is the source of truth for who is on
 * the team. Emails and invite/sign-in state live in `auth.users`, so those are
 * joined in via the admin client. Lock-out state is driven by
 * `agent_profiles.is_disabled` — the same flag `requireUserProfile` checks on
 * every protected route and that `setAgentDisabled` toggles.
 */
export async function getTeamMembers(tenantId: string): Promise<TeamMember[]> {
  const supabase = createSupabaseServerClient();

  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select("id, display_name, role, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = profiles ?? [];
  if (rows.length === 0) return [];

  // Disabled state (agent_profiles is optional — super admins have no row).
  const { data: agentRows } = await supabase
    .from("agent_profiles")
    .select("user_id, is_disabled")
    .eq("tenant_id", tenantId);
  const disabledById = new Map(
    (agentRows ?? []).map((a) => [a.user_id as string, Boolean(a.is_disabled)])
  );

  // Emails + "has the invite been accepted yet" come from auth.users.
  const admin = createSupabaseAdminClient();
  const authById = new Map<string, { email: string | null; hasSignedIn: boolean }>();
  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const user of listed?.users ?? []) {
    authById.set(user.id, {
      email: user.email ?? null,
      hasSignedIn: Boolean(user.last_sign_in_at)
    });
  }

  return rows.map((profile) => {
    const auth = authById.get(profile.id);
    const disabled = disabledById.get(profile.id) ?? false;
    const status: TeamMemberStatus = disabled
      ? "disabled"
      : auth && !auth.hasSignedIn
        ? "pending"
        : "active";

    return {
      id: profile.id,
      display_name: profile.display_name ?? "—",
      role: profile.role ?? "",
      email: auth?.email ?? null,
      status,
      created_at: profile.created_at ?? null
    };
  });
}

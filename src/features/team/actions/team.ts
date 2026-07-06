"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createAgent, setAgentDisabled } from "@/features/agents/actions/agents";
import { teamInviteSchema, type TeamInviteValues } from "../domain/schemas";

function getInviteRedirectBaseDomain(): string | null {
  const envDomain = process.env.APP_PORTAL_DOMAIN;
  if (envDomain) {
    return envDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return null;

  try {
    const host = new URL(appUrl).host;
    if (host.includes("localhost")) return null;
    return host;
  } catch {
    return null;
  }
}

/**
 * Invites a new staff member to the current tenant. Delegates to `createAgent`,
 * which sends the Supabase invite email and creates the `user_profiles` +
 * `agent_profiles` rows. Role is fixed to `admin` for now (see teamInviteSchema).
 */
export async function inviteTeamMember(
  values: TeamInviteValues
): Promise<{ ok: boolean; error?: string }> {
  await requireRole([...ADMIN_ROLES]);
  const payload = teamInviteSchema.parse(values);

  const result = await createAgent({
    email: payload.email,
    display_name: payload.display_name,
    role: payload.role
  });

  if (result.ok) {
    revalidatePath("/settings/team");
  }
  return result;
}

/**
 * Activate or deactivate a team member. Delegates to `setAgentDisabled`, which
 * both flips `agent_profiles.is_disabled` and bans/unbans the Supabase auth user
 * so the account is locked out on every protected route.
 */
export async function setTeamMemberActive(
  userId: string,
  active: boolean
): Promise<{ ok: boolean; error?: string }> {
  await requireRole([...ADMIN_ROLES]);
  try {
    await setAgentDisabled(userId, !active);
    revalidatePath("/settings/team");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to update user." };
  }
}

/**
 * Re-sends the invite email to a team member who has not accepted yet.
 * Tenant-scoped: only re-invites users that belong to the caller's tenant.
 */
export async function resendTeamInvite(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const admin = createSupabaseAdminClient();

  const { data: target } = await admin
    .from("user_profiles")
    .select("id")
    .eq("id", userId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (!target) {
    return { ok: false, error: "This user is not part of your team." };
  }

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });
  if (listError) return { ok: false, error: listError.message };
  const email = listed?.users?.find((user) => user.id === userId)?.email;
  if (!email) return { ok: false, error: "User email not found." };

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "http://localhost:3000";

  let redirectTo = `${appUrl}/invite/accept`;
  const redirectBaseDomain = getInviteRedirectBaseDomain();
  if (redirectBaseDomain) {
    const { data: tenant } = await admin
      .from("tenants")
      .select("slug")
      .eq("id", profile.tenant_id)
      .maybeSingle();
    if (tenant?.slug) {
      redirectTo = `https://${tenant.slug}.${redirectBaseDomain}/invite/accept`;
    }
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/team");
  return { ok: true };
}

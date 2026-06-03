import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../supabase/server";
import { getUserFromAccessTokenCookie } from "./jwt";
import { ensureTenantSetup } from "@/features/tenants/actions/tenants";

export const requireUserProfile = cache(async () => {
  // Decode the access token locally instead of calling supabase.auth.getSession().
  // getSession() auto-refreshes when the token is near expiry; in server components
  // the rotated refresh_token can't be persisted to the response, and parallel
  // server-side reads race to consume the single-use refresh token — both produce
  // intermittent "random logouts". Middleware is the single authoritative refresher.
  const decoded = getUserFromAccessTokenCookie();
  if (!decoded) {
    redirect("/login");
  }

  const supabase = createSupabaseServerClient();
  let { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", decoded.id)
    .single();

  if (!profile) {
    profile = await ensureTenantSetup(decoded.id, decoded.email);
  }

  // Lock disabled agents out of every protected route. agent_profiles is optional
  // (e.g. super_admin users have no row) — a missing row is treated as not disabled.
  const { data: agentProfile } = await supabase
    .from("agent_profiles")
    .select("is_disabled")
    .eq("user_id", decoded.id)
    .maybeSingle();

  if (agentProfile?.is_disabled) {
    await supabase.auth.signOut();
    redirect("/login?disabled=1");
  }

  return profile;
});

export async function requireRole(roles: string[]) {
  const profile = await requireUserProfile();
  const allowed = roles.map((r) => r.toLowerCase());
  const userRole = (profile.role ?? "").toLowerCase();
  if (!allowed.includes(userRole)) {
    redirect("/dashboard");
  }
  return profile;
}

export async function requireSuperAdmin() {
  return requireRole(["super_admin"]);
}

/** For /me: only agents. Admins and others redirect to /earnings. */
export async function requireAgentOnly() {
  const profile = await requireUserProfile();
  const role = (profile.role ?? "").toLowerCase();
  if (role !== "agent") {
    redirect("/earnings");
  }
  return profile;
}

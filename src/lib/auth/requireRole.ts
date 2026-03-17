import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../supabase/server";
import { ensureTenantSetup } from "@/features/tenants/actions/tenants";

export const requireUserProfile = cache(async () => {
  const supabase = createSupabaseServerClient();
  // getSession() reads the JWT from the cookie locally — no auth API network call
  // unless the access token needs refreshing (once per hour). Database RLS with
  // auth.uid() still enforces all security guarantees.
  const {
    data: { session }
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    redirect("/login");
  }

  let { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    profile = await ensureTenantSetup(user.id, user.email ?? undefined);
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

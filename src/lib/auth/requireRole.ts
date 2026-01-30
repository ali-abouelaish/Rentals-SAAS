import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../supabase/server";
import { ensureTenantSetup } from "@/features/tenants/actions/tenants";

export async function requireUserProfile() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

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
}

export async function requireRole(roles: string[]) {
  const profile = await requireUserProfile();
  const allowed = roles.map((role) => role.toLowerCase());
  if (!allowed.includes(profile.role.toLowerCase())) {
    redirect("/dashboard");
  }
  return profile;
}

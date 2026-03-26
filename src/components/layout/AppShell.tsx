import type { ReactNode } from "react";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { getTenantBrandingForApp } from "@/features/admin/data/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShellClient } from "./AppShellClient";

export async function AppShell({ children }: { children: ReactNode }) {
  const profile = await requireUserProfile();

  const supabase = createSupabaseServerClient();
  const [branding, agentRow] = await Promise.all([
    getTenantBrandingForApp(profile.tenant_id),
    supabase
      .from("agent_profiles")
      .select("avatar_url")
      .eq("user_id", profile.id)
      .single()
      .then(({ data }) => data),
  ]);

  return (
    <AppShellClient
      profile={{
        display_name: profile.display_name,
        role: profile.role,
        avatar_url: agentRow?.avatar_url ?? null,
      }}
      branding={branding}
    >
      {children}
    </AppShellClient>
  );
}

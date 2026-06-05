import type { ReactNode } from "react";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { isAdminRole } from "@/lib/auth/roles";
import { getTenantBrandingForApp, getPublishedModuleConfigForApp } from "@/features/admin/data/admin";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShellClient } from "./AppShellClient";

export async function AppShell({ children }: { children: ReactNode }) {
  const profile = await requireUserProfile();

  const supabase = createSupabaseServerClient();
  const [branding, agentRow, moduleConfig, inboxCountRes, entitlementSet] = await Promise.all([
    getTenantBrandingForApp(profile.tenant_id),
    supabase
      .from("agent_profiles")
      .select("avatar_url")
      .eq("user_id", profile.id)
      .single()
      .then(({ data }) => data),
    getPublishedModuleConfigForApp(profile.tenant_id),
    supabase
      .from("tenant_communication_requests")
      .select("id", { head: true, count: "exact" })
      .eq("tenant_id", profile.tenant_id)
      .eq("status", "pending"),
    getEntitlements(),
  ]);

  const inboxPendingCount = inboxCountRes?.count ?? 0;
  const entitlements = [...entitlementSet];

  const assistantEnabled =
    isAdminRole(profile.role) &&
    moduleConfig.property_management_enabled &&
    entitlementSet.has("ai_assistant");

  return (
    <AppShellClient
      profile={{
        display_name: profile.display_name,
        role: profile.role,
        avatar_url: agentRow?.avatar_url ?? null,
      }}
      tenantId={profile.tenant_id}
      branding={branding}
      moduleConfig={moduleConfig}
      inboxPendingCount={inboxPendingCount}
      entitlements={entitlements}
      helpEnabled={entitlementSet.has("help_center")}
      assistantEnabled={assistantEnabled}
    >
      {children}
    </AppShellClient>
  );
}

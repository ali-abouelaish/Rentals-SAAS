import type { ReactNode } from "react";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { getTenantBrandingForApp } from "@/features/admin/data/admin";
import { AppShellClient } from "./AppShellClient";

export async function AppShell({ children }: { children: ReactNode }) {
  const profile = await requireUserProfile();
  const branding = await getTenantBrandingForApp(profile.tenant_id);

  return (
    <AppShellClient
      profile={{ display_name: profile.display_name, role: profile.role }}
      branding={branding}
    >
      {children}
    </AppShellClient>
  );
}

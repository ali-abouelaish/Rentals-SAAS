"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandingStyles } from "./BrandingStyles";
import { SideNav } from "./SideNav";
import { GlobalSearchBar } from "@/features/search/ui/GlobalSearchBar";
import type { PublishedModuleConfig, TenantBrandingSettings } from "@/features/admin/domain/types";

type Profile = { display_name: string | null; role: string | null; avatar_url: string | null };

export function AppShellClient({
  profile,
  tenantId,
  branding,
  moduleConfig,
  inboxPendingCount,
  entitlements,
  children,
}: {
  profile: Profile;
  tenantId: string;
  branding: TenantBrandingSettings | null;
  moduleConfig: PublishedModuleConfig;
  inboxPendingCount: number;
  entitlements: string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isSuperAdminPanel = pathname.startsWith("/admin");
  const applyTenantBranding = !isSuperAdminPanel && branding;

  // Search is workspace-scoped; the super admin panel runs across tenants
  // and has nothing meaningful to search from this index.
  const showSearch = !isSuperAdminPanel;

  return (
    <div className="h-dvh bg-surface-ground p-2 md:p-3 flex gap-3 overflow-hidden">
      {applyTenantBranding && <BrandingStyles branding={branding} />}
      <SideNav
        profile={profile}
        branding={
          applyTenantBranding && branding
            ? { logoUrl: branding.logo_url, brandName: branding.brand_name }
            : null
        }
        moduleConfig={moduleConfig}
        inboxPendingCount={inboxPendingCount}
        entitlements={entitlements}
      />
      <main className="flex-1 min-w-0 overflow-y-auto bg-surface-card rounded-bento shadow-bento">
        {showSearch && (
          <div className="sticky top-0 z-30 flex items-center justify-end gap-3 border-b border-border/60 bg-surface-card/95 px-4 py-3 backdrop-blur-md md:justify-center lg:px-10">
            <GlobalSearchBar tenantId={tenantId} />
          </div>
        )}
        <div className="px-6 pt-8 pb-4 lg:px-10 lg:pt-10 lg:pb-4">{children}</div>
      </main>
    </div>
  );
}

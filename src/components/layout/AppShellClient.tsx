"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandingStyles } from "./BrandingStyles";
import { SideNav } from "./SideNav";
import { BottomNav } from "./mobile/BottomNav";
import { brandInitials } from "./navConfig";
import { GlobalSearchBar } from "@/features/search/ui/GlobalSearchBar";
import { HelpButton } from "@/features/help/ui/HelpButton";
import { MiniAssistant } from "@/features/assistant/ui/MiniAssistant";
import type { PublishedModuleConfig, TenantBrandingSettings } from "@/features/admin/domain/types";

type Profile = { display_name: string | null; role: string | null; avatar_url: string | null };

export function AppShellClient({
  profile,
  tenantId,
  branding,
  moduleConfig,
  entitlements,
  helpEnabled,
  assistantEnabled,
  children,
}: {
  profile: Profile;
  tenantId: string;
  branding: TenantBrandingSettings | null;
  moduleConfig: PublishedModuleConfig;
  entitlements: string[];
  helpEnabled: boolean;
  assistantEnabled: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isSuperAdminPanel = pathname.startsWith("/admin");
  const applyTenantBranding = !isSuperAdminPanel && branding;

  // Search is workspace-scoped; the super admin panel runs across tenants
  // and has nothing meaningful to search from this index.
  const showSearch = !isSuperAdminPanel;

  return (
    <div className="h-dvh bg-surface-ground p-0 md:p-3 flex gap-0 md:gap-3 overflow-hidden">
      {applyTenantBranding && <BrandingStyles branding={branding} />}
      <SideNav
        profile={profile}
        branding={
          applyTenantBranding && branding
            ? { logoUrl: branding.logo_url, brandName: branding.brand_name }
            : null
        }
        moduleConfig={moduleConfig}
        entitlements={entitlements}
      />
      <main className="flex-1 min-w-0 overflow-y-auto bg-surface-card rounded-none shadow-none md:rounded-bento md:shadow-bento">
        {showSearch && (
          <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-surface-card/95 px-4 py-3 backdrop-blur-md md:justify-center lg:px-10">
            {/* Brand mark — mobile only (desktop shows it in the sidebar) */}
            <div className="flex min-w-0 items-center gap-2 md:hidden">
              {branding?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logo_url} alt="" className="h-7 w-7 rounded-lg object-contain" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-[11px] font-semibold text-brand-fg">
                  {brandInitials(branding?.brand_name ?? "Harbor Ops")}
                </div>
              )}
              <span className="truncate text-sm font-semibold text-foreground">
                {branding?.brand_name ?? "Harbor Ops"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <GlobalSearchBar tenantId={tenantId} />
              {helpEnabled && <HelpButton />}
            </div>
          </div>
        )}
        <div className="px-6 pt-8 pb-24 md:pb-4 lg:px-10 lg:pt-10">{children}</div>
      </main>
      {!isSuperAdminPanel && (
        <BottomNav profile={profile} moduleConfig={moduleConfig} entitlements={entitlements} />
      )}
      {assistantEnabled && !isSuperAdminPanel && pathname !== "/assistant" && (
        <MiniAssistant />
      )}
    </div>
  );
}

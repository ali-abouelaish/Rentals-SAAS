"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandingStyles } from "./BrandingStyles";
import { SideNav } from "./SideNav";
import type { TenantBrandingSettings } from "@/features/admin/domain/types";

type Profile = { display_name: string | null; role: string | null };

export function AppShellClient({
  profile,
  branding,
  children,
}: {
  profile: Profile;
  branding: TenantBrandingSettings | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isSuperAdminPanel = pathname.startsWith("/admin");
  const applyTenantBranding = !isSuperAdminPanel && branding;

  return (
    <div className="h-screen bg-surface-ground p-2 md:p-3 flex gap-3 overflow-hidden">
      {applyTenantBranding && <BrandingStyles branding={branding} />}
      <SideNav
        profile={profile}
        branding={
          applyTenantBranding && branding
            ? { logoUrl: branding.logo_url, brandName: branding.brand_name }
            : null
        }
      />
      <main className="flex-1 overflow-y-auto bg-surface-card rounded-bento shadow-bento">
        <div className="px-6 py-8 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}

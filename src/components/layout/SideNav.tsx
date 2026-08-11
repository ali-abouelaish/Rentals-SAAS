"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Sparkles, Shield, ChevronDown, LogOut } from "lucide-react";
import { SUPER_ADMIN_ROLES, canAccessRoute } from "@/lib/auth/roles";
import { signOut } from "@/features/auth/actions/auth";
import { useState, useEffect, Suspense } from "react";
import type { PublishedModuleConfig } from "@/features/admin/domain/types";
import {
  RA_NAV_ITEMS,
  PM_NAV_GROUPS,
  PM_SETTINGS_ITEMS,
  PM_ASSISTANT_ITEM,
  isPmRoute,
  brandInitials,
  type NavItem,
} from "./navConfig";

interface SideNavProps {
  profile: {
    display_name: string | null;
    role: string | null;
    avatar_url?: string | null;
  };
  branding?: { logoUrl: string | null; brandName: string | null } | null;
  moduleConfig: PublishedModuleConfig;
  entitlements?: string[];
}



/** Inner component — reads searchParams so must be inside Suspense. */
function SideNavInner({ profile, branding, moduleConfig, entitlements }: SideNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const onSettingsRoute = PM_SETTINGS_ITEMS.some(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/")
  );
  const [settingsOpen, setSettingsOpen] = useState(onSettingsRoute);

  const isSuperAdminOnly = (profile.role ?? "").toLowerCase() === "super_admin";
  const hasBoth =
    moduleConfig.rental_agency_enabled && moduleConfig.property_management_enabled;
  const hasPmOnly =
    !moduleConfig.rental_agency_enabled && moduleConfig.property_management_enabled;

  // Determine which sidebar context is active
  const activeModule: "ra" | "pm" = (() => {
    if (!hasBoth) return hasPmOnly ? "pm" : "ra";
    // "Both" agency — derive from route or ?view= param.
    // Shared routes (like /settings) use ?view=pm to stay in PM mode.
    if (searchParams.get("view") === "pm") return "pm";
    if (searchParams.get("view") === "ra") return "ra";
    if (pathname === "/dashboard") return "ra";
    return isPmRoute(pathname) ? "pm" : "ra";
  })();

  const isPm = activeModule === "pm";

  // Brand identity
  const raBrandName = branding?.brandName?.trim() || (isPm ? "Property Co." : "Rental Agency");
  const raLogoUrl = branding?.logoUrl?.trim();

  useEffect(() => {
    setNavigatingTo(null);
  }, [pathname]);

  // Auto-expand the Settings section when navigating onto one of its routes.
  useEffect(() => {
    if (PM_SETTINGS_ITEMS.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"))) {
      setSettingsOpen(true);
    }
  }, [pathname]);

  // Resolve the single best-matching href so nested routes (e.g. /contracts vs
  // /contracts/templates) highlight only the most specific nav item.
  const activeHrefs = isPm
    ? [
        ...PM_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)),
        ...PM_SETTINGS_ITEMS.map((i) => i.href),
        PM_ASSISTANT_ITEM.href,
        "/admin",
      ]
    : [...RA_NAV_ITEMS.map((i) => i.href), "/admin"];

  const bestMatch =
    activeHrefs
      .filter((h) => pathname === h || pathname.startsWith(h + "/"))
      .sort((a, b) => b.length - a.length)[0] ?? null;

  const isActive = (href: string) => href === bestMatch;

  const hasEntitlement = (key: string) => (entitlements ?? []).includes(key);

  const renderLink = (item: NavItem) => {
    if (item.allowedRoles && !canAccessRoute(profile.role, item.allowedRoles)) return null;
    if (item.entitlement && !hasEntitlement(item.entitlement)) return null;
    if (item.entitlementAny && !item.entitlementAny.some(hasEntitlement)) return null;
    const active = isActive(item.href);
    // For shared routes (dashboard + settings), carry ?view=pm so the sidebar
    // stays in PM mode for tenants with both modules enabled.
    const needsViewParam =
      isPm && hasBoth && (item.href === "/dashboard" || item.href.startsWith("/settings"));
    const linkHref = needsViewParam ? `${item.href}?view=pm` : item.href;

    return (
      <Link
        key={item.href}
        href={linkHref}
        prefetch={false}
        onClick={() => {
          setNavigatingTo(item.href);
        }}
        className={cn(
          "group flex items-center gap-3 px-3 py-2 text-[13px] font-medium",
          "transition-all duration-base ease-default",
          active
            ? "rounded-full bg-accent text-accent-fg shadow-glow"
            : "rounded-lg text-sidebar-text hover:bg-white/[0.06] hover:text-white",
          navigatingTo === item.href && "opacity-80"
        )}
      >
        <item.icon
          size={17}
          strokeWidth={active ? 2.2 : 1.8}
          className={cn(
            "shrink-0 transition-colors",
            active ? "text-accent-fg" : "text-sidebar-text group-hover:text-white"
          )}
        />
        <span className="flex-1 truncate">{item.label}</span>
      </Link>
    );
  };

  // Logo block — initials/logo mark with brand name + module label.
  const logoBlock = (
    <div className="flex items-center gap-3 px-5 pt-6 pb-5">
      {raLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={raLogoUrl}
          alt=""
          className="h-10 w-10 rounded-xl object-contain bg-white/10 p-1 shrink-0"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent font-semibold text-accent-fg text-[13px] shadow-glow shrink-0">
          {isPm ? brandInitials(raBrandName) : "R"}
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-bold tracking-tight text-white truncate">
          {raBrandName}
        </span>
        <span className="text-[11px] text-sidebar-text">
          {isPm ? "Property Management" : "Management"}
        </span>
      </div>
    </div>
  );

  // PM body: labelled groups + collapsible settings. RA body: flat list.
  const navBody = isSuperAdminOnly ? (
    <div className="space-y-0.5">
      {renderLink({ href: "/admin", label: "Super Admin", icon: Shield })}
    </div>
  ) : isPm ? (
    <div className="space-y-0.5">
      {PM_NAV_GROUPS.map((group) => {
        const links = group.items.map(renderLink).filter(Boolean);
        if (links.length === 0) return null;
        return (
          <div key={group.title}>
            <div className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
              {group.title}
            </div>
            <div className="space-y-0.5">{links}</div>
          </div>
        );
      })}

      {/* Collapsible Settings section */}
      {(() => {
        const settingsLinks = PM_SETTINGS_ITEMS.map(renderLink).filter(Boolean);
        if (settingsLinks.length === 0) return null;
        return (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-expanded={settingsOpen}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:opacity-80"
            >
              <span>Settings</span>
              <ChevronDown
                size={14}
                className={cn(
                  "transition-transform duration-base",
                  settingsOpen ? "" : "-rotate-90"
                )}
              />
            </button>
            {settingsOpen && (
              <div className="mt-0.5 ml-4 space-y-0.5 border-l border-white/[0.06] pl-1.5">
                {settingsLinks}
              </div>
            )}
          </div>
        );
      })()}

      {/* Super admin link (rare cross-role case) */}
      {canAccessRoute(profile.role, SUPER_ADMIN_ROLES) && (
        <div className="pt-2">
          {renderLink({ href: "/admin", label: "Super Admin", icon: Shield })}
        </div>
      )}
    </div>
  ) : (
    <div className="space-y-0.5">
      {RA_NAV_ITEMS.filter((item) => item.href !== "/admin").map(renderLink)}
      {canAccessRoute(profile.role, SUPER_ADMIN_ROLES) &&
        renderLink({ href: "/admin", label: "Super Admin", icon: Shield })}
    </div>
  );

  const navContent = (
    <>
      {logoBlock}

      <div className="mx-5 h-px bg-white/[0.06] mb-2" />

      <nav className="flex-1 px-3 py-2 overflow-y-auto">{navBody}</nav>

      {/* Footer: Ask AI Assistant pill (PM) + user area */}
      <div className="p-3 pt-2">
        {isPm &&
          canAccessRoute(profile.role, PM_ASSISTANT_ITEM.allowedRoles ?? []) && (
            <Link
              href={PM_ASSISTANT_ITEM.href}
              prefetch={false}
              onClick={() => {
                setNavigatingTo(PM_ASSISTANT_ITEM.href);
              }}
              className={cn(
                "mb-3 flex items-center gap-2.5 rounded-full px-3.5 py-2.5 text-[13px] font-medium",
                "transition-all duration-base ease-default",
                isActive(PM_ASSISTANT_ITEM.href)
                  ? "bg-accent text-accent-fg shadow-glow"
                  : "bg-white/[0.07] text-accent hover:bg-white/[0.12]"
              )}
            >
              <Sparkles size={16} className="shrink-0" />
              <span className="truncate">{PM_ASSISTANT_ITEM.label}</span>
            </Link>
          )}

        <div className="mx-1 h-px bg-white/[0.06] mb-3" />

        <div className="flex items-center gap-3 px-1">
          <div className="h-9 w-9 rounded-full overflow-hidden ring-1 ring-white/[0.08] shrink-0">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.display_name ?? ""}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white/10 text-white text-sm font-semibold">
                {profile.display_name?.[0]?.toUpperCase() ?? "A"}
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[13px] font-medium text-white truncate">
              {profile.display_name ?? "User"}
            </span>
            <span className="text-[11px] text-sidebar-text capitalize">
              {profile.role === "agent_and_marketing"
                ? "Agent"
                : profile.role?.replace(/_/g, " ")}
            </span>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-text transition-colors duration-base hover:bg-white/[0.06] hover:text-red-400"
            >
              <LogOut size={17} />
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Global progress bar */}
      {navigatingTo && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-brand overflow-hidden"
          role="progressbar"
          aria-label="Loading"
        >
          <div className="nav-loading-bar-inner h-full w-1/3 bg-brand-fg/30" />
        </div>
      )}

      {/* Desktop Sidebar (mobile uses the bottom nav + "More" sheet instead) */}
      <aside
        className="hidden w-[260px] shrink-0 flex-col md:flex rounded-bento backdrop-blur-xl overflow-hidden"
        style={{ backgroundColor: "var(--sidebar-glass-bg)" }}
      >
        {navContent}
      </aside>
    </>
  );
}

export function SideNav(props: SideNavProps) {
  return (
    <Suspense fallback={<SideNavSkeleton />}>
      <SideNavInner {...props} />
    </Suspense>
  );
}

function SideNavSkeleton() {
  return (
    <>
      <aside className="hidden w-[260px] shrink-0 flex-col md:flex rounded-bento backdrop-blur-xl overflow-hidden opacity-40 pointer-events-none"
        style={{ backgroundColor: "var(--sidebar-glass-bg)" }}
      >
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          <div className="h-10 w-10 rounded-xl bg-white/10 shrink-0" />
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="h-2.5 w-16 rounded bg-white/[0.06]" />
          </div>
        </div>
      </aside>
    </>
  );
}

"use client";

/**
 * Mobile bottom tab bar (`md:hidden`) — the primary navigation on phones,
 * replacing the sidebar. Layout: [Home] [tab] [＋ create] [tab] [More].
 * Tabs and quick-create adapt to the tenant's active module (RA vs PM) and
 * the user's role/entitlements.
 */
import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Home,
  Wrench,
  Banknote,
  Warehouse,
  Inbox,
  Users,
  ClipboardList,
  LayoutGrid,
  Plus,
  Building2,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { PublishedModuleConfig } from "@/features/admin/domain/types";
import { resolveActiveModule, canSeeItem, isAdminRoute, type NavItem } from "../navConfig";
import { QuickActionSheet } from "./QuickActionSheet";
import { MoreMenuSheet } from "./MoreMenuSheet";

type Profile = {
  display_name: string | null;
  role: string | null;
  avatar_url?: string | null;
};

type Props = {
  profile: Profile;
  moduleConfig: PublishedModuleConfig;
  entitlements: string[];
};

type Tab = NavItem & { short: string };

const PM_TAB_CANDIDATES: Tab[] = [
  { href: "/maintenance", label: "Maintenance", short: "Maint", icon: Wrench, allowedRoles: ADMIN_ROLES },
  { href: "/rent-collection", label: "Rent Collection", short: "Rent", icon: Banknote, allowedRoles: ADMIN_ROLES },
  { href: "/properties", label: "Properties", short: "Props", icon: Warehouse, allowedRoles: ADMIN_ROLES },
];

const RA_TAB_CANDIDATES: Tab[] = [
  { href: "/leads", label: "Leads", short: "Leads", icon: Inbox },
  { href: "/clients", label: "Clients", short: "Clients", icon: Users, allowedRoles: ADMIN_ROLES },
  { href: "/rentals", label: "Rentals", short: "Rentals", icon: ClipboardList },
];

/**
 * Tabs for the super-admin console.
 *
 * A super-admin-only account was previously shown the RA tabs — Leads, Clients,
 * Rentals — every one of which `requireRole` bounces straight back to /dashboard.
 * The bottom bar was four dead ends and a More button.
 */
const ADMIN_TAB_CANDIDATES: Tab[] = [
  { href: "/admin/tenants", label: "Agencies", short: "Agencies", icon: Building2 },
  { href: "/admin/billing", label: "Billing", short: "Billing", icon: CreditCard },
];

function BottomNavInner({ profile, moduleConfig, entitlements }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const role = profile.role;

  const module = resolveActiveModule({
    moduleConfig,
    pathname,
    viewParam: searchParams.get("view"),
  });
  const hasBoth =
    moduleConfig.rental_agency_enabled && moduleConfig.property_management_enabled;

  // Matches the sidebar and the More sheet: inside /admin, or for an account that
  // is only ever a super admin, this bar navigates the console.
  const isSuperAdminOnly = (role ?? "").toLowerCase() === "super_admin";
  const showAdminNav = isSuperAdminOnly || isAdminRoute(pathname);

  const candidates = showAdminNav
    ? ADMIN_TAB_CANDIDATES
    : module === "pm"
      ? PM_TAB_CANDIDATES
      : RA_TAB_CANDIDATES;
  const midTabs = candidates.filter((t) => canSeeItem(t, role, entitlements)).slice(0, 2);

  const homeHref = showAdminNav
    ? "/admin"
    : module === "pm" && hasBoth
      ? "/dashboard?view=pm"
      : "/dashboard";
  const homeActive = showAdminNav ? pathname === "/admin" : pathname === "/dashboard";

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(href + "/");

  const TabLink = ({ href, short, icon: Icon, active }: { href: string; short: string; icon: LucideIcon; active: boolean }) => (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors",
        active ? "text-brand" : "text-foreground-muted"
      )}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.1 : 1.8} />
      <span>{short}</span>
    </Link>
  );

  const TabButton = ({ short, icon: Icon, onClick, label }: { short: string; icon: LucideIcon; onClick: () => void; label: string }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-foreground-muted transition-colors active:text-foreground"
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
      <span>{short}</span>
    </button>
  );

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="grid h-14 grid-cols-5 items-stretch px-1">
          <TabLink
            href={homeHref}
            short={showAdminNav ? "Admin" : "Home"}
            icon={Home}
            active={homeActive}
          />

          {midTabs[0] ? (
            <TabLink href={midTabs[0].href} short={midTabs[0].short} icon={midTabs[0].icon} active={isActive(midTabs[0].href)} />
          ) : (
            <span />
          )}

          {/* center ＋ create — omitted in the console, where every quick action
              it offers (new client, new rental) is an agency route a super admin
              cannot reach. The cell is kept so the 5-column layout is unchanged. */}
          {showAdminNav ? (
            <span />
          ) : (
            <div className="flex items-start justify-center">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                aria-label="Create"
                className="-mt-5 grid h-12 w-12 place-items-center rounded-full border-4 border-surface-card bg-gradient-to-br from-brand to-brand-hover text-brand-fg shadow-lg transition-transform active:scale-90"
              >
                <Plus className="h-6 w-6" strokeWidth={2.4} />
              </button>
            </div>
          )}

          {midTabs[1] ? (
            <TabLink href={midTabs[1].href} short={midTabs[1].short} icon={midTabs[1].icon} active={isActive(midTabs[1].href)} />
          ) : (
            <span />
          )}

          <TabButton short="More" icon={LayoutGrid} onClick={() => setMoreOpen(true)} label="Open menu" />
        </div>
      </nav>

      <QuickActionSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        module={module}
        role={role}
        entitlements={entitlements}
      />
      <MoreMenuSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        module={module}
        moduleConfig={moduleConfig}
        profile={profile}
        entitlements={entitlements}
      />
    </>
  );
}

export function BottomNav(props: Props) {
  return (
    <Suspense fallback={null}>
      <BottomNavInner {...props} />
    </Suspense>
  );
}

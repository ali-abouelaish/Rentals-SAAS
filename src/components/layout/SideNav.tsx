"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  BadgePercent,
  Sparkles,
  Users,
  ClipboardList,
  ClipboardEdit,
  Building2,
  Home,
  Settings,
  LogOut,
  FileText,
  Gift,
  Menu,
  X,
  CreditCard,
  User,
  Shield,
  Inbox,
  Warehouse,
  CalendarCheck,
  Users2,
  FileSignature,
  Banknote,
  Landmark,
  Wrench,
  Megaphone,
  TrendingUp,
  Layers,
  Search,
  Share2,
  Key as KeyIcon,
} from "lucide-react";
import { ADMIN_ROLES, SUPER_ADMIN_ROLES, canAccessRoute } from "@/lib/auth/roles";
import { signOut } from "@/features/auth/actions/auth";
import { useState, useEffect, Suspense } from "react";
import type { PublishedModuleConfig } from "@/features/admin/domain/types";

interface SideNavProps {
  profile: {
    display_name: string | null;
    role: string | null;
    avatar_url?: string | null;
  };
  branding?: { logoUrl: string | null; brandName: string | null } | null;
  moduleConfig: PublishedModuleConfig;
  inboxPendingCount?: number;
}

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  allowedRoles?: readonly string[];
};

const RA_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox, allowedRoles: ADMIN_ROLES },
  { href: "/me", label: "My Profile", icon: User },
  { href: "/earnings", label: "Earnings", icon: BadgePercent, allowedRoles: ADMIN_ROLES },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/leads", label: "Leads", icon: Inbox },
  { href: "/rentals", label: "Rentals", icon: ClipboardList },
  { href: "/landlords", label: "Landlords", icon: Building2 },
  { href: "/bonuses", label: "Bonuses", icon: Gift },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/room-enhancer", label: "Room Enhancer", icon: Sparkles },
  { href: "/agents", label: "Agents", icon: Home, allowedRoles: ADMIN_ROLES },
  { href: "/settings/billing-profiles", label: "Billing", icon: Settings, allowedRoles: ADMIN_ROLES },
  { href: "/settings/billing-info", label: "Billing info", icon: CreditCard, allowedRoles: ADMIN_ROLES },
  { href: "/settings/api-keys", label: "API Keys", icon: KeyIcon, allowedRoles: ADMIN_ROLES },
];

const PM_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox, allowedRoles: ADMIN_ROLES },
  { href: "/properties", label: "Properties", icon: Warehouse, allowedRoles: ADMIN_ROLES },
  { href: "/bookings", label: "Bookings", icon: CalendarCheck, allowedRoles: ADMIN_ROLES },
  { href: "/tenants", label: "Tenants", icon: Users2, allowedRoles: ADMIN_ROLES },
  { href: "/contracts", label: "Contracts", icon: FileSignature, allowedRoles: ADMIN_ROLES },
  { href: "/profitability", label: "Profitability", icon: TrendingUp, allowedRoles: ADMIN_ROLES },
  { href: "/rent-collection", label: "Rent Collection", icon: Banknote, allowedRoles: ADMIN_ROLES },
  { href: "/maintenance", label: "Maintenance", icon: Wrench, allowedRoles: ADMIN_ROLES },
  { href: "/keys", label: "Keys", icon: KeyIcon, allowedRoles: ADMIN_ROLES },
  { href: "/acquisition-insights", label: "Acquisition Insights", icon: Search, allowedRoles: ADMIN_ROLES },
  { href: "/marketing", label: "Marketing", icon: Megaphone, allowedRoles: ADMIN_ROLES },
  { href: "/shares", label: "Property Shares", icon: Share2, allowedRoles: ADMIN_ROLES },
  { href: "/settings/booking-forms", label: "Booking Forms", icon: ClipboardEdit, allowedRoles: ADMIN_ROLES },
  { href: "/settings/bank-details", label: "Bank Details", icon: Landmark, allowedRoles: ADMIN_ROLES },
  { href: "/settings/billing-info", label: "Settings", icon: Settings, allowedRoles: ADMIN_ROLES },
  { href: "/settings/api-keys", label: "API Keys", icon: KeyIcon, allowedRoles: ADMIN_ROLES },
];

const PM_ROUTE_PREFIXES = [
  "/inbox",
  "/properties",
  "/bookings",
  "/tenants",
  "/contracts",
  "/profitability",
  "/rent-collection",
  "/maintenance",
  "/keys",
  "/acquisition-insights",
  "/marketing",
  "/shares",
  "/settings/booking-forms",
  "/settings/bank-details",
];

function isPmRoute(pathname: string) {
  return PM_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

/** Inner component — reads searchParams so must be inside Suspense. */
function SideNavInner({ profile, branding, moduleConfig, inboxPendingCount = 0 }: SideNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

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
  const navItems = isPm ? PM_NAV_ITEMS : RA_NAV_ITEMS;

  // Brand identity
  const raBrandName = branding?.brandName?.trim() || "Rental Agency";
  const raLogoUrl = branding?.logoUrl?.trim();

  useEffect(() => {
    setNavigatingTo(null);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  // Logo block — differs between RA and PM
  const logoBlock = isPm ? (
    <div className="flex items-center gap-3 px-5 pt-6 pb-5">
      {raLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={raLogoUrl}
          alt=""
          className="h-10 w-10 rounded-xl object-contain bg-white/10 p-1 shrink-0"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent font-bold text-accent-fg text-sm shadow-glow shrink-0">
          <Layers size={18} />
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-bold tracking-tight text-white truncate">
          {raBrandName}
        </span>
        <span className="text-[11px] text-sidebar-text">Property Management</span>
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-3 px-5 pt-6 pb-5">
      {raLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={raLogoUrl}
          alt=""
          className="h-10 w-10 rounded-xl object-contain bg-white/10 p-1 shrink-0"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent font-bold text-accent-fg text-sm shadow-glow shrink-0">
          R
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-bold tracking-tight text-white truncate">
          {raBrandName}
        </span>
        <span className="text-[11px] text-sidebar-text">Management</span>
      </div>
    </div>
  );

  const navContent = (
    <>
      {logoBlock}

      <div className="mx-5 h-px bg-white/[0.06] mb-2" />

      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-0.5">
        {(isSuperAdminOnly
          ? [{ href: "/admin", label: "Super Admin", icon: Shield } as NavItem]
          : navItems.filter((item) => item.href !== "/admin")
        ).map((item) => {
          if (item.allowedRoles && !canAccessRoute(profile.role, item.allowedRoles)) return null;
          const active = isActive(item.href);
          // For shared routes (dashboard + settings), carry ?view=pm so the
          // sidebar stays in PM mode for tenants with both modules enabled.
          const needsViewParam =
            isPm && hasBoth && (item.href === "/dashboard" || item.href.startsWith("/settings"));
          const linkHref = needsViewParam ? `${item.href}?view=pm` : item.href;

          return (
            <Link
              key={item.href}
              href={linkHref}
              prefetch={false}
              onClick={() => {
                setMobileOpen(false);
                setNavigatingTo(item.href);
              }}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium",
                "transition-all duration-base ease-default",
                active
                  ? "bg-accent text-accent-fg shadow-glow"
                  : "text-sidebar-text hover:bg-white/[0.06] hover:text-white",
                navigatingTo === item.href && "opacity-80"
              )}
            >
              <item.icon
                size={18}
                strokeWidth={active ? 2.2 : 1.8}
                className={cn(
                  "shrink-0 transition-colors",
                  active ? "text-accent-fg" : "text-sidebar-text group-hover:text-white"
                )}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {item.href === "/inbox" && inboxPendingCount > 0 && (
                <span
                  className={cn(
                    "ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                    active ? "bg-white/20 text-white" : "bg-accent text-accent-fg"
                  )}
                  aria-label={`${inboxPendingCount} pending requests`}
                >
                  {inboxPendingCount > 99 ? "99+" : inboxPendingCount}
                </span>
              )}
            </Link>
          );
        })}

        {/* Super admin link for non-super-admin-only users */}
        {!isSuperAdminOnly &&
          canAccessRoute(profile.role, SUPER_ADMIN_ROLES) && (
            <Link
              href="/admin"
              prefetch={false}
              onClick={() => {
                setMobileOpen(false);
                setNavigatingTo("/admin");
              }}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium",
                "transition-all duration-base ease-default",
                isActive("/admin")
                  ? "bg-accent text-accent-fg shadow-glow"
                  : "text-sidebar-text hover:bg-white/[0.06] hover:text-white",
                navigatingTo === "/admin" && "opacity-80"
              )}
            >
              <Shield
                size={18}
                strokeWidth={isActive("/admin") ? 2.2 : 1.8}
                className={cn(
                  "shrink-0 transition-colors",
                  isActive("/admin")
                    ? "text-accent-fg"
                    : "text-sidebar-text group-hover:text-white"
                )}
              />
              Super Admin
            </Link>
          )}
      </nav>

      {/* User Area */}
      <div className="p-4">
        <div className="mx-1 h-px bg-white/[0.06] mb-4" />
        <div className="flex items-center gap-3 px-2 mb-3">
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
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-medium text-white truncate">
              {profile.display_name ?? "User"}
            </span>
            <span className="text-[11px] text-sidebar-text capitalize">
              {profile.role === "agent_and_marketing"
                ? "Agent"
                : profile.role?.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        <form action={signOut}>
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-sidebar-text transition-colors duration-base hover:text-red-400 hover:bg-white/[0.04]">
            <LogOut size={15} />
            Sign out
          </button>
        </form>
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

      {/* Mobile Hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-fg shadow-bento md:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col md:hidden",
          "rounded-r-bento backdrop-blur-xl",
          "transition-transform duration-slow ease-default",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ backgroundColor: "var(--sidebar-glass-bg)" }}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-5 right-4 text-sidebar-text hover:text-white transition-colors"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
        {navContent}
      </aside>

      {/* Desktop Sidebar */}
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

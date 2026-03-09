"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  BadgePercent,
  Sparkles,
  Users,
  ClipboardList,
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
} from "lucide-react";
import { ADMIN_ROLES, canAccessRoute } from "@/lib/auth/roles";
import { signOut } from "@/features/auth/actions/auth";
import { useState, useEffect } from "react";

interface SideNavProps {
  profile: {
    display_name: string | null;
    role: string | null;
  };
}

const navItems: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  allowedRoles?: readonly string[];
}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/me", label: "My Profile", icon: User, allowedRoles: ["agent"] },
  { href: "/earnings", label: "Earnings", icon: BadgePercent, allowedRoles: ADMIN_ROLES },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/rentals", label: "Rentals", icon: ClipboardList },
  { href: "/landlords", label: "Landlords", icon: Building2 },
  { href: "/bonuses", label: "Bonuses", icon: Gift },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/room-enhancer", label: "Room Enhancer", icon: Sparkles },
  { href: "/agents", label: "Agents", icon: Home, allowedRoles: ADMIN_ROLES },
  { href: "/settings/billing-profiles", label: "Billing", icon: Settings, allowedRoles: ADMIN_ROLES },
  { href: "/settings/billing-info", label: "Billing info", icon: CreditCard, allowedRoles: ADMIN_ROLES },
];

export function SideNav({ profile }: SideNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  // Clear navigating state when the route has changed
  useEffect(() => {
    setNavigatingTo(null);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const navContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent font-bold text-accent-fg text-sm shadow-glow">
          R
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-white">
            Rental Agency
          </span>
          <span className="text-[11px] text-sidebar-text">Management</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-white/[0.06] mb-2" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-0.5">
        {navItems.map((item) => {
          if (item.allowedRoles && !canAccessRoute(profile.role, item.allowedRoles)) return null;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
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
                  active
                    ? "text-accent-fg"
                    : "text-sidebar-text group-hover:text-white"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Area */}
      <div className="p-4">
        <div className="mx-1 h-px bg-white/[0.06] mb-4" />
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white text-sm font-semibold ring-1 ring-white/[0.08]">
            {profile.display_name?.[0]?.toUpperCase() ?? "A"}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-medium text-white truncate">
              {profile.display_name ?? "User"}
            </span>
            <span className="text-[11px] text-sidebar-text capitalize">
              {profile.role?.replace("_", " ")}
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
      {/* Global progress bar — shows immediately on nav click */}
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

      {/* Desktop Sidebar — Glassmorphism */}
      <aside
        className="hidden w-[260px] shrink-0 flex-col md:flex rounded-bento backdrop-blur-xl overflow-hidden"
        style={{ backgroundColor: "var(--sidebar-glass-bg)" }}
      >
        {navContent}
      </aside>
    </>
  );
}

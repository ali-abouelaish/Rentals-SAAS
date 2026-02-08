"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  BadgePercent,
  Users,
  ClipboardList,
  Building2,
  Home,
  Settings,
  LogOut
} from "lucide-react";
import { signOut } from "@/features/auth/actions/auth";
import { motion } from "framer-motion";

interface SideNavProps {
  profile: {
    display_name: string | null;
    role: string | null;
  };
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/earnings", label: "Earnings", icon: BadgePercent },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/rentals", label: "Rentals", icon: ClipboardList },
  { href: "/landlords", label: "Landlords", icon: Building2 },
  { href: "/bonuses", label: "Bonuses", icon: BadgePercent },
  { href: "/invoices", label: "Invoices", icon: BadgePercent },
  { href: "/agents", label: "Agents", icon: Home, adminOnly: true },
  { href: "/settings/billing-profiles", label: "Billing Profiles", icon: Settings, adminOnly: true }
];

export function SideNav({ profile }: SideNavProps) {
  const pathname = usePathname();

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-text md:flex"
    >
      <div className="flex h-16 items-center px-6">
        <span className="text-xl font-bold tracking-tight text-white">Rental Agency</span>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-4">
        {navItems.map((item) => {
          if (item.adminOnly && profile.role !== "super_admin") return null;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-gradient-accent text-brand-950 font-bold shadow-glow"
                  : "hover:bg-sidebar-hover text-sidebar-text hover:text-sidebar-textActive"
              )}
            >
              <item.icon
                size={20}
                className={cn(
                  "transition-colors",
                  isActive ? "text-brand-950" : "text-sidebar-text group-hover:text-sidebar-textActive"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-brand-950 font-bold shadow-glow">
            {profile.display_name?.[0] ?? "A"}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">
              {profile.display_name ?? "Admin User"}
            </span>
            <span className="text-xs text-sidebar-text capitalize">{profile.role?.replace("_", " ")}</span>
          </div>
        </div>

        <form action={signOut}>
          <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-sidebar-text transition-colors hover:text-red-400 hover:bg-white/5">
            <LogOut size={16} />
            Sign out
          </button>
        </form>
      </div>
    </motion.aside>
  );
}

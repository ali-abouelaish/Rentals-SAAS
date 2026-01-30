import Link from "next/link";
import {
  BadgePercent,
  Building2,
  ClipboardList,
  Home,
  LayoutDashboard,
  Settings,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

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

export function SideNav({ role }: { role: string }) {
  const isAdmin = role.toLowerCase() === "admin";

  return (
    <aside className="w-56 shrink-0">
      <nav className="rounded-2xl border border-muted bg-card p-3 shadow-soft">
        <ul className="space-y-1">
          {navItems
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-muted"
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
        </ul>
      </nav>
    </aside>
  );
}

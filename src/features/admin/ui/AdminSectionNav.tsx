"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const adminNav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/tenants", label: "Tenants" },
  { href: "/admin/activity", label: "Activity" }
];

export function AdminSectionNav() {
  const pathname = usePathname();

  return (
    <div className="rounded-xl border border-border bg-surface-inset p-2">
      <div className="flex flex-wrap gap-2">
        {adminNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-brand text-brand-fg"
                  : "text-foreground-secondary hover:bg-surface-card hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}


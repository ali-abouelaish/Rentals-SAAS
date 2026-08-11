"use client";

/**
 * Full navigation as a bottom sheet, opened from the "More" tab in `BottomNav`.
 * Replaces the old slide-in drawer on mobile. Reuses the shared nav config so
 * grouping, routes, and role/entitlement gating match the desktop sidebar.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, ChevronRight, LogOut, type LucideIcon } from "lucide-react";
import { SUPER_ADMIN_ROLES, canAccessRoute } from "@/lib/auth/roles";
import { signOut } from "@/features/auth/actions/auth";
import type { PublishedModuleConfig } from "@/features/admin/domain/types";
import {
  PM_NAV_GROUPS,
  PM_SETTINGS_ITEMS,
  PM_ASSISTANT_ITEM,
  RA_NAV_ITEMS,
  canSeeItem,
  type NavItem,
  type NavGroup,
} from "../navConfig";
import { MobileSheet, MobileSheetContent } from "./MobileSheet";

export function MoreMenuSheet({
  open,
  onOpenChange,
  module,
  moduleConfig,
  profile,
  entitlements,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: "ra" | "pm";
  moduleConfig: PublishedModuleConfig;
  profile: { display_name: string | null; role: string | null; avatar_url?: string | null };
  entitlements: string[];
}) {
  const pathname = usePathname();
  const role = profile.role;
  const hasBoth =
    moduleConfig.rental_agency_enabled && moduleConfig.property_management_enabled;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const linkHref = (item: NavItem) => {
    const needsViewParam =
      module === "pm" &&
      hasBoth &&
      (item.href === "/dashboard" || item.href.startsWith("/settings"));
    return needsViewParam ? `${item.href}?view=pm` : item.href;
  };

  const Row = ({ item }: { item: NavItem }) => {
    if (!canSeeItem(item, role, entitlements)) return null;
    const active = isActive(item.href);
    const Icon: LucideIcon = item.icon;
    return (
      <Link
        href={linkHref(item)}
        prefetch={false}
        onClick={() => onOpenChange(false)}
        className="flex items-center gap-3.5 rounded-xl px-2 py-2.5 transition-colors active:bg-surface-inset"
      >
        <span
          className={
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg " +
            (active ? "bg-brand text-brand-fg" : "bg-surface-inset text-foreground-secondary")
          }
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </span>
        <span className="flex-1 truncate text-[15px] font-medium text-foreground">
          {item.label}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" />
      </Link>
    );
  };

  const Group = ({ group }: { group: NavGroup }) => {
    const visible = group.items.filter((i) => canSeeItem(i, role, entitlements));
    if (visible.length === 0) return null;
    return (
      <div className="mb-1">
        <div className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">
          {group.title}
        </div>
        {visible.map((item) => (
          <Row key={item.href} item={item} />
        ))}
      </div>
    );
  };

  const superAdmin: NavItem = { href: "/admin", label: "Super Admin", icon: Shield };

  return (
    <MobileSheet open={open} onOpenChange={onOpenChange}>
      <MobileSheetContent title="All areas">
        {module === "pm" ? (
          <>
            {PM_NAV_GROUPS.map((group) => (
              <Group key={group.title} group={group} />
            ))}
            <Group group={{ title: "Settings", items: PM_SETTINGS_ITEMS }} />
            <div className="mb-1">
              <div className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">
                Assistant
              </div>
              <Row item={PM_ASSISTANT_ITEM} />
              {canAccessRoute(role, SUPER_ADMIN_ROLES) && <Row item={superAdmin} />}
            </div>
          </>
        ) : (
          <div className="pt-1">
            {RA_NAV_ITEMS.filter((i) => i.href !== "/admin").map((item) => (
              <Row key={item.href} item={item} />
            ))}
            {canAccessRoute(role, SUPER_ADMIN_ROLES) && <Row item={superAdmin} />}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-surface-inset text-sm font-semibold text-foreground-secondary">
                {profile.display_name?.[0]?.toUpperCase() ?? "A"}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">
              {profile.display_name ?? "User"}
            </div>
            <div className="truncate text-xs capitalize text-foreground-muted">
              {profile.role === "agent_and_marketing" ? "Agent" : profile.role?.replace(/_/g, " ")}
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-surface-inset hover:text-error"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </form>
        </div>
      </MobileSheetContent>
    </MobileSheet>
  );
}

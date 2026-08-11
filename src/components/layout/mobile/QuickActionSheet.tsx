"use client";

/**
 * Quick-create bottom sheet launched by the center ＋ in `BottomNav`.
 *
 * "New work order" is self-contained (property picker inside the modal),
 * so it deep-links with `?action=new` and the Maintenance page auto-opens
 * RaiseJobModal on arrival. Recording a payment / sending a reminder need a
 * tenancy or recipient chosen first, so those land on their section page.
 */
import Link from "next/link";
import { Wrench, Banknote, Bell, Inbox, Users, ClipboardList, ChevronRight, type LucideIcon } from "lucide-react";
import { canAccessRoute, ADMIN_ROLES } from "@/lib/auth/roles";
import { MobileSheet, MobileSheetContent } from "./MobileSheet";

type QuickAction = {
  label: string;
  sub: string;
  href: string;
  icon: LucideIcon;
  tint: string;
  allowedRoles?: readonly string[];
  entitlement?: string;
};

const PM_ACTIONS: QuickAction[] = [
  {
    label: "New work order",
    sub: "Property, issue, priority, supplier",
    href: "/maintenance?action=new",
    icon: Wrench,
    tint: "bg-blue-50 text-blue-600",
    allowedRoles: ADMIN_ROLES,
  },
  {
    label: "Record rent payment",
    sub: "Pick a tenancy, then log it",
    href: "/rent-collection",
    icon: Banknote,
    tint: "bg-emerald-50 text-emerald-600",
    allowedRoles: ADMIN_ROLES,
  },
  {
    label: "Send reminder",
    sub: "Nudge a tenant about rent or docs",
    href: "/reminders",
    icon: Bell,
    tint: "bg-amber-50 text-amber-600",
    allowedRoles: ADMIN_ROLES,
    entitlement: "automations",
  },
];

const RA_ACTIONS: QuickAction[] = [
  { label: "Add lead", sub: "Capture a new enquiry", href: "/leads", icon: Inbox, tint: "bg-blue-50 text-blue-600" },
  { label: "Add client", sub: "Go to clients", href: "/clients", icon: Users, tint: "bg-violet-50 text-violet-600", allowedRoles: ADMIN_ROLES },
  { label: "New rental", sub: "Go to rentals", href: "/rentals", icon: ClipboardList, tint: "bg-emerald-50 text-emerald-600" },
];

export function QuickActionSheet({
  open,
  onOpenChange,
  module,
  role,
  entitlements,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: "ra" | "pm";
  role: string | null;
  entitlements: string[];
}) {
  const actions = (module === "pm" ? PM_ACTIONS : RA_ACTIONS).filter((a) => {
    if (a.allowedRoles && !canAccessRoute(role, a.allowedRoles)) return false;
    if (a.entitlement && !entitlements.includes(a.entitlement)) return false;
    return true;
  });

  return (
    <MobileSheet open={open} onOpenChange={onOpenChange}>
      <MobileSheetContent title="Create">
        {actions.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-foreground-secondary">
            No quick actions available for your role.
          </p>
        ) : (
          <div className="flex flex-col">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                prefetch={false}
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-4 rounded-xl px-2 py-3 transition-colors active:bg-surface-inset"
              >
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${a.tint}`}>
                  <a.icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-foreground">{a.label}</span>
                  <span className="block text-xs text-foreground-muted">{a.sub}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" />
              </Link>
            ))}
          </div>
        )}
      </MobileSheetContent>
    </MobileSheet>
  );
}

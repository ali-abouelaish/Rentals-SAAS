/**
 * Shared navigation config — single source of truth for the desktop sidebar
 * (`SideNav`) and the mobile shell (`BottomNav`, `MoreMenuSheet`).
 *
 * Keep nav items here so a change to labels/routes/gating updates every surface.
 */
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
  FileText,
  Gift,
  CreditCard,
  User,
  Inbox,
  Warehouse,
  CalendarCheck,
  Users2,
  FileSignature,
  Banknote,
  Landmark,
  Wrench,
  TrendingUp,
  Search,
  Share2,
  Wallet,
  ShieldCheck,
  Key as KeyIcon,
  ListChecks,
  Mail,
  Bell,
  Zap,
} from "lucide-react";
import { ADMIN_ROLES, canAccessRoute } from "@/lib/auth/roles";
import type { PublishedModuleConfig } from "@/features/admin/domain/types";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  allowedRoles?: readonly string[];
  /** When set, the item only renders if the tenant has this feature entitlement. */
  entitlement?: string;
  /** When set, the item renders if the tenant has ANY of these entitlements. */
  entitlementAny?: readonly string[];
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const RA_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
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

export const PM_NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Lettings",
    items: [
      { href: "/properties", label: "Properties", icon: Warehouse, allowedRoles: ADMIN_ROLES },
      // Property OWNERS (owner_landlords) — not the rental-agency /landlords page.
      { href: "/owners", label: "Landlords", icon: Building2, allowedRoles: ADMIN_ROLES, entitlement: "owner_statements" },
      { href: "/tenants", label: "Tenants", icon: Users2, allowedRoles: ADMIN_ROLES },
      { href: "/bookings", label: "Bookings", icon: CalendarCheck, allowedRoles: ADMIN_ROLES },
      { href: "/contracts", label: "Contracts", icon: FileSignature, allowedRoles: ADMIN_ROLES },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/rent-collection", label: "Rent Collection", icon: Banknote, allowedRoles: ADMIN_ROLES },
      { href: "/finances", label: "Finances", icon: Wallet, allowedRoles: ADMIN_ROLES },
      { href: "/profitability", label: "Profitability", icon: TrendingUp, allowedRoles: ADMIN_ROLES },
      { href: "/deposits", label: "Deposit Protection", icon: ShieldCheck, allowedRoles: ADMIN_ROLES, entitlementAny: ["mydeposits", "tds", "dps"] },
    ],
  },
  {
    title: "Growth",
    items: [
      { href: "/acquisition-insights", label: "Acquisition Insights", icon: Search, allowedRoles: ADMIN_ROLES },
      { href: "/shares", label: "Property Shares", icon: Share2, allowedRoles: ADMIN_ROLES },
    ],
  },
  {
    title: "Forms",
    items: [
      { href: "/settings/booking-forms", label: "Booking Forms", icon: ClipboardEdit, allowedRoles: ADMIN_ROLES },
      { href: "/forms", label: "Forms", icon: ListChecks, allowedRoles: ADMIN_ROLES, entitlement: "forms" },
    ],
  },
  {
    title: "Tools",
    items: [
      { href: "/maintenance", label: "Maintenance", icon: Wrench, allowedRoles: ADMIN_ROLES },
      { href: "/compliance", label: "Compliance", icon: ShieldCheck, allowedRoles: ADMIN_ROLES, entitlement: "certificates" },
      { href: "/reminders", label: "Reminders", icon: Bell, allowedRoles: ADMIN_ROLES, entitlement: "automations" },
      { href: "/automations", label: "Automations", icon: Zap, allowedRoles: ADMIN_ROLES, entitlement: "automations" },
    ],
  },
];

export const PM_SETTINGS_ITEMS: NavItem[] = [
  { href: "/settings/team", label: "Team", icon: Users2, allowedRoles: ADMIN_ROLES },
  { href: "/settings/bank-details", label: "Bank Details", icon: Landmark, allowedRoles: ADMIN_ROLES },
  { href: "/settings/api-keys", label: "API Keys", icon: KeyIcon, allowedRoles: ADMIN_ROLES },
  { href: "/settings/email", label: "Email Sending", icon: Mail, allowedRoles: ADMIN_ROLES },
  { href: "/settings/messaging", label: "Messaging", icon: Bell, allowedRoles: ADMIN_ROLES, entitlement: "automations" },
  { href: "/settings/billing-info", label: "General", icon: Settings, allowedRoles: ADMIN_ROLES },
];

export const PM_ASSISTANT_ITEM: NavItem = {
  href: "/assistant",
  label: "Ask AI Assistant",
  icon: Sparkles,
  allowedRoles: ADMIN_ROLES,
};

export const PM_ROUTE_PREFIXES = [
  "/inbox",
  "/properties",
  "/bookings",
  "/tenants",
  "/contracts",
  "/compliance",
  "/profitability",
  "/rent-collection",
  "/finances",
  "/maintenance",
  "/assistant",
  "/keys",
  "/acquisition-insights",
  "/marketing",
  "/shares",
  "/settings/booking-forms",
  "/settings/bank-details",
  "/settings/team",
  "/settings/email",
  "/settings/messaging",
  "/deposits",
  "/settings/deposits",
  "/forms",
  "/reminders",
  "/automations",
  "/owners",
];

export function isPmRoute(pathname: string) {
  return PM_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

/** Initials fallback for the brand mark when no logo is set (e.g. "AP Real Estate" → "AP"). */
export function brandInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
  return letters.toUpperCase() || "PM";
}

/** Which nav context (rental agency vs property management) is active for this tenant + route. */
export function resolveActiveModule(opts: {
  moduleConfig: PublishedModuleConfig;
  pathname: string;
  viewParam: string | null;
}): "ra" | "pm" {
  const { moduleConfig, pathname, viewParam } = opts;
  const hasBoth =
    moduleConfig.rental_agency_enabled && moduleConfig.property_management_enabled;
  const hasPmOnly =
    !moduleConfig.rental_agency_enabled && moduleConfig.property_management_enabled;

  if (!hasBoth) return hasPmOnly ? "pm" : "ra";
  if (viewParam === "pm") return "pm";
  if (viewParam === "ra") return "ra";
  if (pathname === "/dashboard") return "ra";
  return isPmRoute(pathname) ? "pm" : "ra";
}

/** Role + entitlement gating shared by every nav surface. */
export function canSeeItem(
  item: NavItem,
  role: string | null | undefined,
  entitlements: string[]
): boolean {
  if (item.allowedRoles && !canAccessRoute(role, item.allowedRoles)) return false;
  if (item.entitlement && !entitlements.includes(item.entitlement)) return false;
  if (item.entitlementAny && !item.entitlementAny.some((e) => entitlements.includes(e)))
    return false;
  return true;
}

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
  Plug,
  TrendingUp,
  Share2,
  Wallet,
  ShieldCheck,
  Key as KeyIcon,
  ListChecks,
  Mail,
  Bell,
  Zap,
  HeartPulse,
  ScrollText,
  LifeBuoy,
} from "lucide-react";
import { ADMIN_ROLES, canAccessRoute } from "@/lib/auth/roles";
import type { FeatureKey } from "@/lib/entitlements/features";
import type { PublishedModuleConfig } from "@/features/admin/domain/types";

/**
 * Every item whose page belongs to a feature in the super-admin features manager
 * must carry that feature's key. An item without one always renders, so switching
 * the feature off leaves a link in the sidebar that only leads to /upgrade or a
 * redirect. Typed as FeatureKey so a misspelt key fails the build instead of
 * hiding the link for everyone.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  allowedRoles?: readonly string[];
  /** When set, the item only renders if the tenant has this feature entitlement. */
  entitlement?: FeatureKey;
  /** When set, the item renders if the tenant has ANY of these entitlements. */
  entitlementAny?: readonly FeatureKey[];
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const RA_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, entitlement: "dashboard" },
  { href: "/me", label: "My Profile", icon: User, entitlement: "my_profile" },
  { href: "/earnings", label: "Earnings", icon: BadgePercent, allowedRoles: ADMIN_ROLES, entitlement: "earnings" },
  { href: "/clients", label: "Clients", icon: Users, entitlement: "clients" },
  { href: "/leads", label: "Leads", icon: Inbox, entitlement: "leads" },
  { href: "/rentals", label: "Rentals", icon: ClipboardList, entitlement: "rentals" },
  { href: "/landlords", label: "Landlords", icon: Building2, entitlement: "landlords" },
  { href: "/bonuses", label: "Bonuses", icon: Gift, entitlement: "bonuses" },
  { href: "/invoices", label: "Invoices", icon: FileText, entitlement: "invoices" },
  { href: "/room-enhancer", label: "Room Enhancer", icon: Sparkles, entitlement: "room_enhancer" },
  { href: "/agents", label: "Agents", icon: Home, allowedRoles: ADMIN_ROLES, entitlement: "agents" },
  { href: "/settings/billing-profiles", label: "Billing", icon: Settings, allowedRoles: ADMIN_ROLES, entitlement: "billing_profiles" },
  { href: "/settings/billing-info", label: "Billing info", icon: CreditCard, allowedRoles: ADMIN_ROLES, entitlement: "billing_info" },
  // Shared with PM: connecting a mailbox here makes invoices (and every other
  // agency email) send from the agency's own address.
  { href: "/settings/email", label: "Email Sending", icon: Mail, allowedRoles: ADMIN_ROLES, entitlement: "email_sending" },
  { href: "/settings/api-keys", label: "API Keys", icon: KeyIcon, allowedRoles: ADMIN_ROLES, entitlement: "public_api_access" },
  // Deliberately NO allowedRoles: every agency user — not just admins — must be
  // able to reach us. Don't "fix" this to ADMIN_ROLES like its neighbours.
  { href: "/helpdesk", label: "Contact Support", icon: LifeBuoy, entitlement: "support_tickets" },
];

export const PM_NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, entitlement: "dashboard" }],
  },
  {
    title: "Lettings",
    items: [
      { href: "/properties", label: "Properties", icon: Warehouse, allowedRoles: ADMIN_ROLES, entitlement: "properties" },
      // Property OWNERS (owner_landlords) — not the rental-agency /landlords page.
      { href: "/owners", label: "Landlords", icon: Building2, allowedRoles: ADMIN_ROLES, entitlement: "owner_statements" },
      { href: "/tenants", label: "Tenants", icon: Users2, allowedRoles: ADMIN_ROLES, entitlement: "pm_tenants" },
      { href: "/bookings", label: "Bookings", icon: CalendarCheck, allowedRoles: ADMIN_ROLES, entitlement: "bookings" },
      { href: "/contracts", label: "Contracts", icon: FileSignature, allowedRoles: ADMIN_ROLES, entitlement: "contracts" },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/rent-collection", label: "Rent Collection", icon: Banknote, allowedRoles: ADMIN_ROLES, entitlement: "rent_collection" },
      { href: "/finances", label: "Finances", icon: Wallet, allowedRoles: ADMIN_ROLES, entitlement: "finances" },
      { href: "/profitability", label: "Profitability", icon: TrendingUp, allowedRoles: ADMIN_ROLES, entitlement: "profitability" },
      { href: "/deposits", label: "Deposit Protection", icon: ShieldCheck, allowedRoles: ADMIN_ROLES, entitlementAny: ["mydeposits", "tds", "dps"] },
    ],
  },
  {
    title: "Growth",
    items: [
      { href: "/shares", label: "Property Shares", icon: Share2, allowedRoles: ADMIN_ROLES, entitlement: "property_shares" },
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
      { href: "/maintenance", label: "Maintenance", icon: Wrench, allowedRoles: ADMIN_ROLES, entitlement: "maintenance" },
      { href: "/compliance", label: "Compliance", icon: ShieldCheck, allowedRoles: ADMIN_ROLES, entitlement: "certificates" },
      { href: "/reminders", label: "Reminders", icon: Bell, allowedRoles: ADMIN_ROLES, entitlement: "automations" },
      { href: "/automations", label: "Automations", icon: Zap, allowedRoles: ADMIN_ROLES, entitlement: "automations" },
      // Deliberately NO allowedRoles: every agency user — not just admins — must be
      // able to reach us. Don't "fix" this to ADMIN_ROLES like its neighbours.
      { href: "/helpdesk", label: "Contact Support", icon: LifeBuoy, entitlement: "support_tickets" },
    ],
  },
];

export const PM_SETTINGS_ITEMS: NavItem[] = [
  { href: "/settings/team", label: "Team", icon: Users2, allowedRoles: ADMIN_ROLES },
  { href: "/settings/bank-details", label: "Bank Details", icon: Landmark, allowedRoles: ADMIN_ROLES },
  { href: "/settings/api-keys", label: "API Keys", icon: KeyIcon, allowedRoles: ADMIN_ROLES, entitlement: "public_api_access" },
  { href: "/settings/email", label: "Email Sending", icon: Mail, allowedRoles: ADMIN_ROLES, entitlement: "email_sending" },
  { href: "/settings/messaging", label: "Messaging", icon: Bell, allowedRoles: ADMIN_ROLES, entitlement: "automations" },
  { href: "/settings/integrations", label: "Integrations", icon: Plug, allowedRoles: ADMIN_ROLES },
  { href: "/settings/billing-info", label: "General", icon: Settings, allowedRoles: ADMIN_ROLES, entitlement: "billing_info" },
];

export const PM_ASSISTANT_ITEM: NavItem = {
  href: "/assistant",
  label: "Ask AI Assistant",
  icon: Sparkles,
  allowedRoles: ADMIN_ROLES,
  entitlement: "ai_assistant",
};

/**
 * The super-admin console's own sections.
 *
 * These used to be a horizontal tab bar rendered by the /admin layout, which
 * meant the sidebar showed a single "Super Admin" link and then the real
 * navigation lived somewhere else entirely — a super admin's sidebar was almost
 * empty while every section hid in a strip above the page. They are ordinary nav
 * groups now, so the sidebar, the mobile sheet and the active-highlight logic all
 * read from this one list.
 *
 * No `allowedRoles` on the items: the whole /admin tree is already gated by
 * `requireSuperAdmin()` in its layout, and the surfaces below only render these
 * groups for a super admin. Adding a role check here would be a third place to
 * keep in step with the other two.
 */
export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    title: "Platform",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      // "Agencies", not "Tenants". In this schema `tenants` are agencies while
      // `pm_tenants` are renters, and the admin console is the one place both
      // meanings are in play at once.
      { href: "/admin/tenants", label: "Agencies", icon: Building2 },
      { href: "/admin/billing", label: "Billing", icon: CreditCard },
      // Billing is what agencies owe us; Finance is our own P&L — that revenue
      // set against what it costs to run the platform. Adjacent on purpose.
      { href: "/admin/finance", label: "Finance", icon: TrendingUp },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/health", label: "System Health", icon: HeartPulse },
      { href: "/admin/activity", label: "Activity Log", icon: ScrollText },
      { href: "/admin/support", label: "Support Tickets", icon: LifeBuoy },
      // Prospects from the public website's Request a demo page — not agencies yet.
      { href: "/admin/demo-requests", label: "Demo Requests", icon: CalendarCheck },
    ],
  },
  {
    title: "Integrations",
    items: [
      { href: "/admin/deposit-schemes", label: "Deposit Schemes", icon: Landmark },
      { href: "/admin/e-signing", label: "E-signing", icon: FileSignature },
    ],
  },
];

/** Every admin href, for the sidebar's longest-match active resolution. */
export const ADMIN_NAV_HREFS = ADMIN_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => item.href)
);

export function isAdminRoute(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

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
  "/settings/integrations",
  "/settings/e-signing",
  "/deposits",
  "/settings/deposits",
  "/forms",
  "/reminders",
  "/automations",
  "/owners",
  "/helpdesk",
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

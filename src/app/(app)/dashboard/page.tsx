import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { isAdminRole } from "@/lib/auth/roles";
import { LayoutDashboard, Building2, FileText } from "lucide-react";
import { getDashboardData } from "@/features/profitability/data/queries";
import { getRentalDashboardData } from "@/features/rentals-dashboard/data/queries";
import { PMDashboardPage } from "@/features/pm-dashboard/ui/PMDashboardPage";
import { getDashboardActivityFeed } from "@/features/pm-dashboard/data/activity-feed";
import { getDashboardTodos, getTodoHistory, getTodoPropertyOptions } from "@/features/pm-dashboard/data/todos";
import { RentalDashboardPage } from "@/features/rentals-dashboard/ui/RentalDashboardPage";
import { getPublishedModuleConfigForApp } from "@/features/admin/data/admin";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { getUpcomingReminders, type InboxMessage } from "@/features/automations/data/queries";
import { getQuickLinks } from "@/features/quick-links/data/queries";
import { QuickLinksSection } from "@/features/quick-links/ui/QuickLinksSection";

// Render on every request and skip the fetch Data Cache — the dashboard's
// vacancy days, arrears and reminders are time-sensitive and must be live.
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { view?: string };
}) {
  const profile = await requireUserProfile();
  const isAdmin = isAdminRole(profile.role);
  const moduleConfig = await getPublishedModuleConfigForApp(profile.tenant_id);

  const hasBoth = moduleConfig.rental_agency_enabled && moduleConfig.property_management_enabled;
  const hasPmOnly = !moduleConfig.rental_agency_enabled && moduleConfig.property_management_enabled;

  // Determine which view to render
  // - PM-only agencies always see PM dashboard
  // - RA-only agencies always see rental dashboard
  // - Both agencies: admins can toggle via ?view param (default: rental)
  const view: "rental" | "pm" = (() => {
    if (hasPmOnly) return "pm";
    if (!moduleConfig.property_management_enabled) return "rental";
    // Both: admin can switch; agents stay on rental
    return isAdmin ? ((searchParams?.view ?? "rental") as "rental" | "pm") : "rental";
  })();

  const showTabToggle = hasBoth && isAdmin;

  try {
    if (view === "pm") {
      const [data, activity, todos, todoHistory, todoProperties, entitlements, quickLinks] = await Promise.all([
        getDashboardData({ isAdmin }),
        getDashboardActivityFeed().catch(() => []),
        getDashboardTodos().catch(() => []),
        getTodoHistory().catch(() => []),
        getTodoPropertyOptions().catch(() => []),
        getEntitlements().catch(() => new Set<string>()),
        getQuickLinks().catch(() => []),
      ]);
      // Reminders rail only shows for tenants entitled to automations.
      const reminders: InboxMessage[] | null = entitlements.has("automations")
        ? await getUpcomingReminders(profile.tenant_id).catch(() => [])
        : null;
      return (
        <div className="space-y-6">
          {showTabToggle && <DashboardTabs active="pm" />}
          <PMDashboardPage
            data={data}
            userName={profile.display_name || "User"}
            activity={activity}
            todos={todos}
            todoHistory={todoHistory}
            todoProperties={todoProperties}
            reminders={reminders}
            topSlot={
              (quickLinks.length > 0 || isAdmin) && (
                <QuickLinksSection links={quickLinks} isAdmin={isAdmin} />
              )
            }
          />
        </div>
      );
    }

    const [data, quickLinks] = await Promise.all([
      getRentalDashboardData(isAdmin ? undefined : profile.id),
      getQuickLinks().catch(() => []),
    ]);
    return (
      <div className="space-y-6">
        {showTabToggle && <DashboardTabs active="rental" />}
        <RentalDashboardPage
          data={data}
          userName={profile.display_name || "User"}
          isAdmin={isAdmin}
          topSlot={
            (quickLinks.length > 0 || isAdmin) && (
              <QuickLinksSection links={quickLinks} isAdmin={isAdmin} />
            )
          }
        />
      </div>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return (
      <div className="space-y-5">
        {showTabToggle && <DashboardTabs active={view} />}
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <LayoutDashboard className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">Failed to load dashboard</p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">{message}</p>
        </div>
      </div>
    );
  }
}

function DashboardTabs({ active }: { active: "rental" | "pm" }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-card p-1 w-fit shadow-sm">
      <Link
        href="/dashboard?view=rental"
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
          active === "rental"
            ? "bg-brand text-brand-fg shadow-sm"
            : "text-foreground-secondary hover:text-foreground hover:bg-surface-inset"
        }`}
      >
        <FileText className="h-3.5 w-3.5" />
        Rental Agency
      </Link>
      <Link
        href="/dashboard?view=pm"
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
          active === "pm"
            ? "bg-brand text-brand-fg shadow-sm"
            : "text-foreground-secondary hover:text-foreground hover:bg-surface-inset"
        }`}
      >
        <Building2 className="h-3.5 w-3.5" />
        Property Management
      </Link>
    </div>
  );
}

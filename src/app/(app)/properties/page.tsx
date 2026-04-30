import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { getProperties } from "@/features/properties/data/properties";
import { getUnits } from "@/features/properties/data/units";
import { getPmTenants } from "@/features/pm-tenants/data/pm-tenants";
import { getRentReminderStatusMap } from "@/features/reminders/data/status";
import { UnitsPage } from "@/features/properties/ui/UnitsPage";
import { Warehouse } from "lucide-react";

export default async function PropertiesPage() {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");

  try {
    const [portfolios, propertiesData, unitsResult, pmTenantsData] = await Promise.all([
      getPortfolios(),
      getProperties(),
      getUnits({}, 1, 200),
      getPmTenants().catch(() => []),
    ]);

    const pmTenants = pmTenantsData.map((t) => ({
      id: t.id,
      full_name: t.full_name,
      email: t.email,
      phone: t.phone,
    }));

    const occupiedPmTenantIds = unitsResult.units
      .map((u) => u.pm_tenant_id ?? u.pm_tenant?.id ?? null)
      .filter((id): id is string => !!id);
    const reminderStatus = await getRentReminderStatusMap(occupiedPmTenantIds);

    return (
      <UnitsPage
        portfolios={portfolios}
        initialProperties={propertiesData}
        initialUnits={unitsResult.units}
        pmTenants={pmTenants}
        reminderStatus={reminderStatus}
      />
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isMissingTable = message.includes("schema cache") || message.includes("does not exist");

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Properties</h1>
        </div>
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <Warehouse className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">
            {isMissingTable ? "Database migrations pending" : "Failed to load properties"}
          </p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
            {isMissingTable
              ? "Apply the 4 migrations in supabase/migrations/20260326100000–100003 to your Supabase database, then reload."
              : message}
          </p>
        </div>
      </div>
    );
  }
}

import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { getUnits } from "@/features/properties/data/units";
import { UnitsPage } from "@/features/properties/ui/UnitsPage";
import { Warehouse } from "lucide-react";

export default async function PropertiesPage() {
  await requireRole([...ADMIN_ROLES]);

  try {
    const [portfolios, unitsResult] = await Promise.all([
      getPortfolios(),
      getUnits({}, 1, 200),
    ]);

    return (
      <UnitsPage
        portfolios={portfolios}
        initialUnits={unitsResult.units}
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

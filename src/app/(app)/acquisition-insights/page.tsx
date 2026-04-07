import { Search } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getEvaluations } from "@/features/acquisition-insights/data/evaluations";
import { AcquisitionInsightsPage } from "@/features/acquisition-insights/ui/AcquisitionInsightsPage";
import { getPortfolios } from "@/features/properties/data/portfolios";

export default async function AcquisitionInsightsRoute() {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");

  try {
    const [evaluations, portfolios] = await Promise.all([
      getEvaluations(),
      getPortfolios(),
    ]);

    return <AcquisitionInsightsPage evaluations={evaluations} portfolios={portfolios} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isMissingTable =
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("relation");

    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Acquisition Insights
        </h1>
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <Search className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">
            {isMissingTable ? "Database migrations pending" : "Failed to load evaluations"}
          </p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
            {isMissingTable
              ? "Apply the Phase 6 migrations in supabase/migrations/20260407000001–000003 to your Supabase database, then reload."
              : message}
          </p>
        </div>
      </div>
    );
  }
}

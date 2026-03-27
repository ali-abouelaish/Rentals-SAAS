import { FileSignature } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getContracts } from "@/features/contracts/data/contracts";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { getPmTenants } from "@/features/pm-tenants/data/pm-tenants";
import { getUnits } from "@/features/properties/data/units";
import { ContractsPage } from "@/features/contracts/ui/ContractsPage";

export default async function ContractsRoute() {
  await requireRole([...ADMIN_ROLES]);

  try {
    const [contracts, portfolios, pmTenants, unitsResult] = await Promise.all([
      getContracts(),
      getPortfolios(),
      getPmTenants(),
      getUnits({}, 1, 500),
    ]);

    const units = unitsResult.units.map((u) => ({
      id: u.id,
      room_number: u.room_number,
      unit_type: u.unit_type,
      property: { name: u.property?.name ?? "" },
    }));

    const tenants = pmTenants.map((t) => ({
      id: t.id,
      full_name: t.full_name,
    }));

    return (
      <ContractsPage
        initialContracts={contracts}
        portfolios={portfolios}
        units={units}
        pmTenants={tenants}
      />
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isMissingTable = message.includes("schema cache") || message.includes("does not exist");

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Contracts</h1>
        </div>
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <FileSignature className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">
            {isMissingTable ? "Database migrations pending" : "Failed to load contracts"}
          </p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
            {isMissingTable
              ? "Apply the Phase 2 migrations in supabase/migrations/ to your Supabase database, then reload."
              : message}
          </p>
        </div>
      </div>
    );
  }
}

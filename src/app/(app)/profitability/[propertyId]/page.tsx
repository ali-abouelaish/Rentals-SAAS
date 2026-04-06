import { notFound } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getPropertyProfitability } from "@/features/profitability/data/queries";
import { PropertyDetailPage } from "@/features/profitability/ui/PropertyDetailPage";

interface Props {
  params: { propertyId: string };
}

export default async function PropertyProfitabilityRoute({ params }: Props) {
  await requireRole([...ADMIN_ROLES]);

  try {
    const property = await getPropertyProfitability(params.propertyId);

    if (!property) {
      notFound();
    }

    return <PropertyDetailPage property={property} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isMissingTable =
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("relation");

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Property P&amp;L</h1>
        </div>
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <TrendingUp className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">
            {isMissingTable ? "Database migrations pending" : "Failed to load property data"}
          </p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
            {isMissingTable
              ? "Apply the Phase 3 migrations in supabase/migrations/20260404000001–000003, then reload."
              : message}
          </p>
        </div>
      </div>
    );
  }
}

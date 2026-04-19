import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getPortfolios } from "@/features/properties/data/portfolios";
import { getProperties } from "@/features/properties/data/properties";
import { NewShareForm } from "@/features/property-shares/ui/NewShareForm";

export const dynamic = "force-dynamic";

export default async function NewSharePage() {
  await requireRole([...ADMIN_ROLES]);

  const [portfolios, properties] = await Promise.all([
    getPortfolios().catch(() => []),
    getProperties().catch(() => []),
  ]);

  const propertyList = properties.map((p) => ({
    id: p.id,
    name: p.name,
    postcode: p.postcode ?? null,
    area: p.area ?? null,
    portfolio_id: p.portfolio_id ?? null,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/shares"
          className="inline-flex items-center gap-1 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to shares
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground tracking-tight">New share</h1>
        <p className="text-sm text-foreground-secondary mt-0.5">
          Generate a public link that exposes units matching your filters to external partners.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-card p-6">
        <NewShareForm portfolios={portfolios} properties={propertyList} />
      </div>
    </div>
  );
}

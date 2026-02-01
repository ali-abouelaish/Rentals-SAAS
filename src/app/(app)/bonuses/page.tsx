import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getBonuses } from "@/features/bonuses/data/bonuses";
import { BonusForm } from "@/features/bonuses/ui/BonusForm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/formatters";

export default async function BonusesPage() {
  const bonuses = await getBonuses();

  return (
    <div className="space-y-6">
      <PageHeader title="Bonuses" subtitle="Landlord bonus submissions" />
      <div className="flex items-center gap-2">
        <Button asChild variant="outline">
          <Link href="/invoices/from-bonuses">Create invoice from bonuses</Link>
        </Button>
      </div>
      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-navy">Submit bonus</p>
          <BonusForm />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <DataTable
            columns={["Landlord", "Amount", "Status"]}
            rows={bonuses.map((bonus) => [
              <span key={`${bonus.id}-landlord`}>{bonus.landlords?.name ?? bonus.landlord_id}</span>,
              <span key={`${bonus.id}-amount`}>{formatCurrency(bonus.amount_owed)}</span>,
              <StatusBadge key={`${bonus.id}-status`} status={bonus.status} />
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}

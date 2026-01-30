import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { getBonuses } from "@/features/bonuses/data/bonuses";
import { approveBonus } from "@/features/bonuses/actions/bonuses";
import { requireRole } from "@/lib/auth/requireRole";
import { formatCurrency } from "@/lib/utils/formatters";

export default async function PendingBonusesPage() {
  await requireRole(["admin"]);
  const bonuses = await getBonuses("pending");

  return (
    <div className="space-y-6">
      <PageHeader title="Pending Bonuses" subtitle="Admin approvals" />
      <Card>
        <CardContent>
          <DataTable
            columns={["Landlord", "Amount", "Action"]}
            rows={bonuses.map((bonus) => [
              <span key={`${bonus.id}-landlord`}>{bonus.landlords?.name ?? bonus.landlord_id}</span>,
              <span key={`${bonus.id}-amount`}>{formatCurrency(bonus.amount_owed)}</span>,
              <form key={`${bonus.id}-action`} action={approveBonus.bind(null, bonus.id)}>
                <Button type="submit" variant="secondary">
                  Approve
                </Button>
              </form>
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}

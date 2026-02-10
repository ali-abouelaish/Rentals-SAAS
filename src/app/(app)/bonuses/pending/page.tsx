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
  const { bonuses } = await getBonuses({ status: "pending" });

  return (
    <div className="space-y-6">
      <PageHeader title="Pending Bonuses" subtitle="Admin approvals" />
      <Card>
        <CardContent>
          <DataTable
            columns={["Landlord", "Amount", "Action"]}
            rows={bonuses.map((bonus) => [
              <span key={`${bonus.id}-landlord`}>
                {Array.isArray(bonus.landlords)
                  ? bonus.landlords[0]?.name
                  : (bonus.landlords as any)?.name ?? bonus.landlord_id}
              </span>,
              <span key={`${bonus.id}-amount`}>{formatCurrency(bonus.amount_owed)}</span>,
              <form
                key={`${bonus.id}-action`}
                action={async () => {
                  "use server";
                  await approveBonus(bonus.id);
                }}
              >
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

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvatarCircle } from "@/components/shared/AvatarCircle";
import { DateRangePicker } from "@/features/commission-file/ui/DateRangePicker";
import { CommissionSummaryCards } from "@/features/commission-file/ui/CommissionSummaryCards";
import { RentalsTable } from "@/features/commission-file/ui/RentalsTable";
import { BonusesTable } from "@/features/commission-file/ui/BonusesTable";
import { PayoutsTable } from "@/features/commission-file/ui/PayoutsTable";
import { getCommissionFileData } from "@/features/commission-file/data/queries";

function getDefaultDateRange(searchParams?: { from?: string; to?: string }) {
  const today = new Date();
  const to = searchParams?.to ?? today.toISOString().slice(0, 10);
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 29);
  const from = searchParams?.from ?? fromDate.toISOString().slice(0, 10);
  return { from, to };
}

function toIsoRange(from: string, to: string) {
  const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999Z`).toISOString();
  return { fromIso, toIso };
}

export default async function AgentCommissionPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { from?: string; to?: string; status?: string };
}) {
  await requireRole(["admin"]);
  const supabase = createSupabaseServerClient();
  const { data: agent } = await supabase
    .from("user_profiles")
    .select("id, display_name, role, agent_profiles(avatar_url)")
    .eq("id", params.id)
    .single();

  if (!agent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-gray-500">Agent not found.</p>
      </div>
    );
  }

  const { from, to } = getDefaultDateRange(searchParams);
  const { fromIso, toIso } = toIsoRange(from, to);
  const includeAllStatuses = searchParams?.status === "all";
  const statuses = includeAllStatuses ? ["approved", "paid", "refunded"] : ["approved"];

  const { rentalRows, bonusRows, payoutRows } = await getCommissionFileData({
    agentId: params.id,
    fromIso,
    toIso,
    includeStatuses: statuses
  });

  const rentalTotals = rentalRows.reduce(
    (acc, rental) => ({
      rental_amount: acc.rental_amount + rental.rental_amount,
      payment_fee: acc.payment_fee + rental.payment_fee,
      base_amount: acc.base_amount + rental.base_amount,
      marketing_fee_deducted: acc.marketing_fee_deducted + rental.marketing_fee_deducted,
      agent_earning: acc.agent_earning + rental.agent_earning
    }),
    {
      rental_amount: 0,
      payment_fee: 0,
      base_amount: 0,
      marketing_fee_deducted: 0,
      agent_earning: 0
    }
  );

  const bonusesEarnings = bonusRows.reduce((sum, bonus) => sum + bonus.agent_earning, 0);
  const totalPayouts = payoutRows.reduce((sum, payout) => sum + payout.amount_gbp, 0);
  const totalOwed = rentalTotals.agent_earning + bonusesEarnings;
  const now = new Date();
  const overdueCutoff = new Date();
  overdueCutoff.setDate(now.getDate() - 7);
  const overdueCount =
    rentalRows.filter(
      (rental) => new Date(rental.created_at) < overdueCutoff && rental.agent_earning > 0
    ).length +
    bonusRows.filter(
      (bonus) => new Date(bonus.created_at) < overdueCutoff && bonus.agent_earning > 0
    ).length;
  const overdueAmount = totalOwed > totalPayouts && overdueCount > 0 ? totalOwed - totalPayouts : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Commission File"
        subtitle={`Commission summary for ${agent.display_name ?? "Agent"}`}
      />

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AvatarCircle
              name={agent.display_name ?? "Agent"}
              url={agent.agent_profiles?.avatar_url ?? null}
            />
            <div>
              <p className="text-sm font-medium text-navy">{agent.display_name ?? "Agent"}</p>
              <p className="text-xs text-gray-500">{agent.role}</p>
            </div>
          </div>
          <DateRangePicker defaultFrom={from} defaultTo={to} />
        </CardContent>
      </Card>

      <CommissionSummaryCards
        rentalsCount={rentalRows.length}
        agentEarnings={rentalTotals.agent_earning}
        bonusesEarnings={bonusesEarnings}
        totalPayouts={totalPayouts}
        overdueAmount={overdueAmount}
        overdueCount={overdueCount}
        agencyNet={rentalTotals.base_amount}
      />

      <Tabs defaultValue="rentals">
        <TabsList>
          <TabsTrigger value="rentals">Rentals (Approved)</TabsTrigger>
          <TabsTrigger value="bonuses">Bonuses</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="rentals">
          <RentalsTable
            rentals={rentalRows}
            totals={rentalTotals}
            agentId={params.id}
            from={from}
            to={to}
            includeAllStatuses={includeAllStatuses}
          />
        </TabsContent>

        <TabsContent value="bonuses">
          <BonusesTable bonuses={bonusRows} />
        </TabsContent>

        <TabsContent value="payouts">
          <PayoutsTable payouts={payoutRows} agentId={params.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

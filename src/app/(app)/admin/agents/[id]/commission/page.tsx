import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
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
import { formatGBP } from "@/lib/utils/formatters";
import { ClipboardList, Gift, CreditCard, AlertTriangle, TrendingUp, Building } from "lucide-react";

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

function getAgentAvatarUrl(
  agentProfiles: { avatar_url: string | null } | { avatar_url: string | null }[] | null
) {
  if (Array.isArray(agentProfiles)) {
    return agentProfiles[0]?.avatar_url ?? null;
  }
  return agentProfiles?.avatar_url ?? null;
}

export default async function AgentCommissionPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { from?: string; to?: string; status?: string };
}) {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const { data: agent } = await supabase
    .from("user_profiles")
    .select("id, display_name, role, agent_profiles(avatar_url)")
    .eq("id", params.id)
    .single();

  if (!agent) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-surface-inset flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-foreground-muted" />
          </div>
          <p className="text-foreground-secondary font-medium">Agent not found</p>
          <p className="text-sm text-foreground-muted mt-1">Please check the agent ID and try again</p>
        </Card>
      </div>
    );
  }

  const { from, to } = getDefaultDateRange(searchParams);
  const { fromIso, toIso } = toIsoRange(from, to);
  const avatarUrl = getAgentAvatarUrl(
    agent.agent_profiles as { avatar_url: string | null } | { avatar_url: string | null }[] | null
  );
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
  const balance = totalOwed - totalPayouts;

  return (
    <div className="space-y-6">
      {/* Hero Section with Agent Profile */}
      <div className="hero-gradient">
        <div className="hero-pattern" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <AvatarCircle
                name={agent.display_name ?? "Agent"}
                url={avatarUrl}
                size="lg"
              />
              <div>
                <h1 className="text-2xl font-bold text-brand-fg">{agent.display_name ?? "Agent"}</h1>
                <p className="text-brand-fg/70 text-sm capitalize">{agent.role?.replace("_", " ") ?? "Agent"}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-brand-fg/60 text-xs uppercase tracking-wide">Balance</p>
                <p className={`text-2xl font-bold ${balance >= 0 ? 'text-success' : 'text-error'}`}>
                  {formatGBP(balance)}
                </p>
              </div>
              <DateRangePicker defaultFrom={from} defaultTo={to} />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-subtle">
                <ClipboardList className="h-4 w-4 text-brand" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide">Rentals</p>
                <p className="text-xl font-bold text-brand">{rentalRows.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success-bg">
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide">Owed</p>
                <p className="text-xl font-bold text-success">{formatGBP(totalOwed)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning-bg">
                <Gift className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide">Bonuses</p>
                <p className="text-xl font-bold text-warning">{formatGBP(bonusesEarnings)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info-bg">
                <CreditCard className="h-4 w-4 text-info" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide">Paid</p>
                <p className="text-xl font-bold text-info">{formatGBP(totalPayouts)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`stat-card ${overdueAmount > 0 ? 'border-error-border bg-error-bg/30' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${overdueAmount > 0 ? 'bg-error-bg' : 'bg-surface-inset'}`}>
                <AlertTriangle className={`h-4 w-4 ${overdueAmount > 0 ? 'text-error' : 'text-foreground-muted'}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide">Overdue</p>
                <p className={`text-xl font-bold ${overdueAmount > 0 ? 'text-error' : 'text-foreground-muted'}`}>
                  {formatGBP(overdueAmount)}
                </p>
                {overdueCount > 0 && (
                  <p className="text-xs text-error">{overdueCount} items &gt; 7 days</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-subtle">
                <Building className="h-4 w-4 text-brand" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide">Agency Net</p>
                <p className="text-xl font-bold text-brand">{formatGBP(rentalTotals.base_amount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="rentals">
        <TabsList className="mb-4">
          <TabsTrigger value="rentals">
            <ClipboardList className="h-4 w-4 mr-2" />
            Rentals ({rentalRows.length})
          </TabsTrigger>
          <TabsTrigger value="bonuses">
            <Gift className="h-4 w-4 mr-2" />
            Bonuses ({bonusRows.length})
          </TabsTrigger>
          <TabsTrigger value="payouts">
            <CreditCard className="h-4 w-4 mr-2" />
            Payouts ({payoutRows.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rentals">
          <Card>
            <CardContent className="p-0">
              <RentalsTable
                rentals={rentalRows}
                totals={rentalTotals}
                agentId={params.id}
                from={from}
                to={to}
                includeAllStatuses={includeAllStatuses}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bonuses">
          <Card>
            <CardContent className="p-0">
              <BonusesTable bonuses={bonusRows} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card>
            <CardContent className="p-0">
              <PayoutsTable payouts={payoutRows} agentId={params.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

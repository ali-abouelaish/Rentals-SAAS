import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { EarningsFilters } from "@/features/earnings/ui/EarningsFilters";
import { EarningsStatCards } from "@/features/earnings/ui/EarningsStatCards";
import { EarningsTrendChart } from "@/features/earnings/ui/EarningsTrendChart";
import { LeaderboardTable } from "@/features/earnings/ui/LeaderboardTable";
import { ExportButton } from "@/features/earnings/ui/ExportButton";
import {
  getEarningsLeaderboard,
  getEarningsStats,
  getEarningsStatsForAgent,
  getEarningsTrend,
  getEarningsTrendForAgent
} from "@/features/earnings/data/queries";
import { requireUserProfile } from "@/lib/auth/requireRole";

function getDefaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10)
  };
}

export default async function EarningsPage({
  searchParams
}: {
  searchParams?: { from?: string; to?: string };
}) {
  const profile = await requireUserProfile();
  const defaults = getDefaultRange();
  const filters = {
    from: searchParams?.from ?? defaults.from,
    to: searchParams?.to ?? defaults.to,
    payment_method: "all"
  };

  try {
    const isAdmin = profile.role.toLowerCase() === "admin";
    const [stats, trend, leaderboard] = await Promise.all([
      isAdmin ? getEarningsStats(filters) : getEarningsStatsForAgent(filters, profile.id),
      isAdmin ? getEarningsTrend(filters) : getEarningsTrendForAgent(filters, profile.id),
      getEarningsLeaderboard(filters)
    ]);

    const filteredRows = leaderboard.slice(0, 10);

    return (
      <div className="space-y-6">
        <PageHeader
          title={isAdmin ? "Agent Earnings" : "My Earnings"}
          subtitle={isAdmin ? "Track earnings across your tenant" : "Your earnings summary"}
          action={<ExportButton />}
        />

        <Card>
          <CardContent>
            <EarningsFilters from={filters.from} to={filters.to} />
          </CardContent>
        </Card>

        <EarningsStatCards stats={stats} />

        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm font-medium text-navy">Earnings trend</p>
            <EarningsTrendChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-navy">Top agents</p>
              {!isAdmin ? (
                <p className="text-xs text-gray-500">Showing top 10 within tenant</p>
              ) : null}
            </div>
            <LeaderboardTable rows={filteredRows} showAgencyTotals={isAdmin} />
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    return (
      <EmptyState
        title="Earnings unavailable"
        description="We could not load earnings data. Please retry later."
      />
    );
  }
}

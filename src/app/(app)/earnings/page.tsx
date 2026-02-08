import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { EarningsFilters } from "@/features/earnings/ui/EarningsFilters";
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
import { FilterBar, FilterRow } from "@/components/ui/filter-bar";
import { Users, TrendingUp, Receipt, Calculator } from "lucide-react";

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
      <div className="space-y-5">
        <PageHeader
          title={isAdmin ? "Agent Earnings" : "My Earnings"}
          subtitle={isAdmin ? "Track earnings across your tenant" : "Your earnings summary"}
          action={<ExportButton />}
        />

        {/* Date Filters */}
        <FilterBar>
          <EarningsFilters from={filters.from} to={filters.to} />
        </FilterBar>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Agents"
            value={stats.totalAgents ?? 0}
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            label="Total Earnings"
            value={`£${(stats.totalEarnings ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            label="Transactions"
            value={stats.totalTransactions ?? 0}
            icon={<Receipt className="h-5 w-5" />}
          />
          <StatCard
            label="Avg Per Agent"
            value={`£${(stats.avgPerAgent ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`}
            icon={<Calculator className="h-5 w-5" />}
          />
        </div>

        {/* Trend Chart */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-brand flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Earnings Trend
              </h3>
            </div>
            <EarningsTrendChart data={trend} />
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-brand flex items-center gap-2">
                <Users className="h-4 w-4" />
                Top Agents
              </h3>
              {!isAdmin && (
                <span className="text-xs text-slate-500">Showing top 10</span>
              )}
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

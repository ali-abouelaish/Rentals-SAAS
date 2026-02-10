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
import {
  Users,
  TrendingUp,
  Receipt,
  Calculator,
  BarChart3,
  Trophy,
  Download,
} from "lucide-react";

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

    const statTiles = [
      {
        label: "Total Agents",
        value: stats.totalAgents ?? 0,
        icon: Users,
        color: "text-blue-600",
        bg: "bg-blue-50",
      },
      {
        label: "Total Earnings",
        value: `£${(stats.totalEarnings ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`,
        icon: TrendingUp,
        color: "text-emerald-600",
        bg: "bg-emerald-50",
      },
      {
        label: "Transactions",
        value: stats.totalTransactions ?? 0,
        icon: Receipt,
        color: "text-violet-600",
        bg: "bg-violet-50",
      },
      {
        label: "Avg Per Agent",
        value: `£${(stats.avgPerAgent ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`,
        icon: Calculator,
        color: "text-amber-600",
        bg: "bg-amber-50",
      },
    ];

    return (
      <div className="space-y-6">
        {/* ── Header ─────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-foreground-secondary text-sm flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Financial Overview
            </p>
            <h1 className="text-2xl font-bold tracking-tight font-heading text-foreground">
              {isAdmin ? "Agent Earnings" : "My Earnings"}
            </h1>
          </div>
          <ExportButton />
        </div>

        {/* ── Filters — inline Bento card ───── */}
        <div className="rounded-bento bg-surface-card shadow-bento px-5 py-4">
          <EarningsFilters from={filters.from} to={filters.to} />
        </div>

        {/* ── Stat Tiles — Bento Row ─────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-[var(--gap-bento)]">
          {statTiles.map((stat) => (
            <div
              key={stat.label}
              className="group rounded-bento bg-surface-card p-5 shadow-bento transition-all duration-base hover:shadow-bento-hover hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-2 tabular-nums">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} strokeWidth={1.8} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Trend Chart — Bento card ───────── */}
        <div className="rounded-bento bg-surface-card shadow-bento p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-50">
                <TrendingUp className="h-4 w-4 text-emerald-600" strokeWidth={2} />
              </div>
              <h2 className="text-base font-semibold text-foreground">Earnings Trend</h2>
            </div>
            <div className="flex items-center gap-4 text-xs text-foreground-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#14213d]" />
                Total
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#E2B808]" />
                Agent
              </span>
            </div>
          </div>
          <EarningsTrendChart data={trend} />
        </div>

        {/* ── Leaderboard — Bento card ────────── */}
        <div className="rounded-bento bg-surface-card shadow-bento p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-50">
                <Trophy className="h-4 w-4 text-amber-600" strokeWidth={2} />
              </div>
              <h2 className="text-base font-semibold text-foreground">Top Agents</h2>
            </div>
            {!isAdmin && (
              <span className="text-xs text-foreground-muted bg-surface-inset px-2.5 py-1 rounded-full">
                Showing top 10
              </span>
            )}
          </div>
          <LeaderboardTable rows={filteredRows} showAgencyTotals={isAdmin} />
        </div>
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

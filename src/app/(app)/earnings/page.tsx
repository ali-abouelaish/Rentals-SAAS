import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { EarningsFilters } from "@/features/earnings/ui/EarningsFilters";
import { EarningsChartSection } from "@/features/earnings/ui/EarningsChartSection";
import { EarningsTrendChart } from "@/features/earnings/ui/EarningsTrendChart";
import { LeaderboardTable } from "@/features/earnings/ui/LeaderboardTable";
import { AllAgentsTable } from "@/features/earnings/ui/AllAgentsTable";
import { ExportButton } from "@/features/earnings/ui/ExportButton";
import {
  getEarningsLeaderboard,
  getEarningsLeaderboardAll,
  getEarningsStats,
  getEarningsStatsForAgent,
  getEarningsTrend,
  getEarningsTrendForAgent,
  getEarningsTrendByAgents,
  getTransactions
} from "@/features/earnings/data/queries";
import { requireUserProfile } from "@/lib/auth/requireRole";
import {
  Users,
  TrendingUp,
  Receipt,
  Calculator,
  BarChart3,
  Trophy,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
    const [stats, trend, leaderboard, leaderboardAll, transactions] = await Promise.all([
      isAdmin ? getEarningsStats(filters) : getEarningsStatsForAgent(filters, profile.id),
      isAdmin ? getEarningsTrend(filters) : getEarningsTrendForAgent(filters, profile.id),
      getEarningsLeaderboard(filters),
      isAdmin ? getEarningsLeaderboardAll(filters) : Promise.resolve([]),
      isAdmin ? getTransactions(filters) : getTransactions(filters, { agentId: profile.id })
    ]);

    const trendByAgents =
      isAdmin && leaderboard.length > 0
        ? await getEarningsTrendByAgents(
            filters,
            leaderboard.slice(0, 3).map((r) => r.agent_id)
          )
        : [];

    const hasData =
      (stats.totalTransactions ?? 0) > 0 ||
      (stats.totalEarnings ?? 0) > 0 ||
      leaderboard.length > 0;
    const topAgent = leaderboard[0];

    const statTiles = isAdmin
      ? [
          {
            label: "Total Agency Earnings",
            value: `£${(stats.totalEarnings ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`,
            icon: TrendingUp,
            color: "text-emerald-600",
            bg: "bg-emerald-50"
          },
          {
            label: "Total Transactions",
            value: stats.totalTransactions ?? 0,
            icon: Receipt,
            color: "text-violet-600",
            bg: "bg-violet-50"
          },
          {
            label: "Rentals Closed",
            value: stats.totalRentalsClosed ?? stats.totalTransactions ?? 0,
            icon: Receipt,
            color: "text-blue-600",
            bg: "bg-blue-50"
          },
          {
            label: "Top Agent",
            value: topAgent
              ? `${topAgent.agent_name} · £${(topAgent.agent_earnings ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`
              : "—",
            icon: Award,
            color: "text-amber-600",
            bg: "bg-amber-50"
          },
          {
            label: "Avg Per Agent",
            value: `£${(stats.avgPerAgent ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`,
            icon: Calculator,
            color: "text-slate-600",
            bg: "bg-slate-50"
          }
        ]
      : [
          {
            label: "Total Earnings",
            value: `£${(stats.totalEarnings ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`,
            icon: TrendingUp,
            color: "text-emerald-600",
            bg: "bg-emerald-50"
          },
          {
            label: "Transactions",
            value: stats.totalTransactions ?? 0,
            icon: Receipt,
            color: "text-violet-600",
            bg: "bg-violet-50"
          },
          {
            label: "Rentals",
            value: stats.totalTransactions ?? 0,
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-50"
          },
          {
            label: "Avg Per Agent",
            value: `£${(stats.avgPerAgent ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`,
            icon: Calculator,
            color: "text-amber-600",
            bg: "bg-amber-50"
          }
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
              {isAdmin ? "Agency Earnings" : "My Earnings"}
            </h1>
          </div>
          <ExportButton
            transactions={transactions}
            from={filters.from}
            to={filters.to}
          />
        </div>

        {/* ── Filters — inline Bento card ───── */}
        <div className="rounded-bento bg-surface-card shadow-bento px-5 py-4">
          <EarningsFilters from={filters.from} to={filters.to} />
        </div>

        {/* ── Stat Tiles — Bento Row ─────────── */}
        <div className={`grid gap-[var(--gap-bento)] ${isAdmin ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5" : "grid-cols-2 xl:grid-cols-4"}`}>
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

        {/* ── Chart (Total / Compare Agents) or single trend ─── */}
        {!hasData ? (
          <div className="rounded-bento bg-surface-card shadow-bento p-8 text-center">
            <p className="text-foreground-muted mb-4">No earnings data in this date range.</p>
            <Button variant="outline" asChild>
              <Link href="/earnings">Clear filters</Link>
            </Button>
          </div>
        ) : (
          <>
            {isAdmin && trend.length > 0 && (
              <Suspense fallback={<div className="rounded-bento bg-surface-card shadow-bento p-6 h-80 animate-pulse" />}>
                <EarningsChartSection
                  trend={trend}
                  trendByAgents={trendByAgents}
                  topAgents={leaderboard}
                />
              </Suspense>
            )}
            {!isAdmin && trend.length > 0 && (
              <div className="rounded-bento bg-surface-card shadow-bento p-6">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="p-2 rounded-lg bg-emerald-50">
                    <TrendingUp className="h-4 w-4 text-emerald-600" strokeWidth={2} />
                  </div>
                  <h2 className="text-base font-semibold text-foreground">Earnings Over Time</h2>
                </div>
                <EarningsTrendChart data={trend} />
              </div>
            )}

            {/* ── Top 3 Leaderboard ───────────────── */}
            <div className="rounded-bento bg-surface-card shadow-bento p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-50">
                    <Trophy className="h-4 w-4 text-amber-600" strokeWidth={2} />
                  </div>
                  <h2 className="text-base font-semibold text-foreground">Top 3 Agents</h2>
                </div>
                {!isAdmin && (
                  <span className="text-xs text-foreground-muted bg-surface-inset px-2.5 py-1 rounded-full">
                    Showing top 10
                  </span>
                )}
              </div>
              <LeaderboardTable rows={leaderboard.slice(0, 10)} showAgencyTotals={isAdmin} />
            </div>

            {/* ── All Agents table (admin only) ────────────────── */}
            {isAdmin && leaderboardAll.length > 0 && (
              <div className="rounded-bento bg-surface-card shadow-bento p-6">
                <h2 className="text-base font-semibold text-foreground mb-5">All Agents</h2>
                <AllAgentsTable rows={leaderboardAll} />
              </div>
            )}
          </>
        )}
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

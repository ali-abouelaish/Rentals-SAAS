import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAgentById } from "@/features/agents/data/agents";
import {
  getEarningsStatsForAgent,
  getEarningsTrendForAgent,
  getTransactions,
} from "@/features/earnings/data/queries";
import { getBonusesForAgent } from "@/features/bonuses/data/bonuses";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { canAccessRoute } from "@/lib/auth/roles";
import { AvatarCircle } from "@/components/shared/AvatarCircle";
import { formatGBP } from "@/lib/utils/formatters";
import { ArrowLeft, TrendingUp, Home, Gift } from "lucide-react";
import { AgentProfileCharts } from "@/features/earnings/ui/AgentProfileCharts";
import { AgentTransactionsTable } from "@/features/earnings/ui/AgentTransactionsTable";
import { AgentBonusesTable } from "@/features/bonuses/ui/AgentBonusesTable";

function getDefaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 90);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    payment_method: "all" as const,
  };
}

export default async function AgentEarningsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { from?: string; to?: string; minAmount?: string };
}) {
  const profile = await requireUserProfile();
  const isAdmin = canAccessRoute(profile.role, ADMIN_ROLES);
  const canView = isAdmin || profile.id === params.id;

  if (!canView) {
    return (
      <div className="rounded-bento bg-surface-card shadow-bento p-8 text-center">
        <p className="text-foreground-muted">You don&apos;t have access to this profile.</p>
      </div>
    );
  }

  const agent = await getAgentById(params.id);
  const defaults = getDefaultRange();
  const filters = {
    from: searchParams?.from ?? defaults.from,
    to: searchParams?.to ?? defaults.to,
    payment_method: "all" as const,
  };
  const minAmount = searchParams?.minAmount ? Number(searchParams.minAmount) : undefined;
  const displayName = agent.user_profiles?.display_name ?? "Agent";

  const [stats, trend, transactions, bonuses] = await Promise.all([
    getEarningsStatsForAgent(filters, params.id),
    getEarningsTrendForAgent(filters, params.id),
    getTransactions(filters, { agentId: params.id }),
    getBonusesForAgent(params.id, filters),
  ]);

  const avgPerRental =
    (stats.totalTransactions ?? 0) > 0
      ? (stats.totalEarnings ?? 0) / (stats.totalTransactions ?? 1)
      : 0;

  const commissionPercent = agent.commission_percent ?? 50;
  const bonusAgentShare = (b: { amount_owed: number; payout_mode?: string | null }) =>
    b.payout_mode === "full" ? b.amount_owed : b.amount_owed * (commissionPercent / 100);

  const totalBonusAmount = bonuses.reduce((sum, b) => sum + bonusAgentShare(b), 0);
  const totalBonusCount = bonuses.length;
  const pendingBonusAmount = bonuses
    .filter((b) => ["pending", "approved", "sent"].includes(b.status))
    .reduce((sum, b) => sum + bonusAgentShare(b), 0);

  return (
    <div className="space-y-6">
      {/* ── Back to Earnings ─────────────────────── */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/earnings" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Earnings
          </Link>
        </Button>
      </div>

      {/* ── Header card: Avatar + stat chips ────── */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-6 pt-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12">
              <AvatarCircle name={displayName} url={agent.avatar_url ?? undefined} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{displayName}</h1>
              <p className="text-sm text-foreground-muted">Earnings · last 90 days</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
              <TrendingUp className="h-3.5 w-3.5" />
              {formatGBP(stats.totalEarnings ?? 0)} earnings
            </span>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
              {stats.totalTransactions ?? 0} rentals
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
              {formatGBP(avgPerRental)} avg / rental
            </span>
            {agent.commission_percent != null && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
                {agent.commission_percent}% commission
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700">
              <Gift className="h-3.5 w-3.5" />
              {totalBonusCount} bonus{totalBonusCount !== 1 ? "es" : ""}
            </span>
            {totalBonusAmount > 0 && (
              <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700">
                {formatGBP(totalBonusAmount)} total bonuses
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ══ RENTALS SECTION ════════════════════════ */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-50">
          <Home className="h-4 w-4 text-blue-600" />
        </div>
        <h2 className="text-base font-semibold text-foreground">Rentals</h2>
        <div className="flex-1 h-px bg-border ml-2" />
      </div>

      <AgentProfileCharts trend={trend} transactions={transactions} />

      <Card>
        <CardContent className="pt-6">
          <AgentTransactionsTable
            transactions={transactions}
            from={filters.from}
            to={filters.to}
            minAmount={minAmount}
          />
        </CardContent>
      </Card>

      {/* ══ BONUSES SECTION ════════════════════════ */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-violet-50">
          <Gift className="h-4 w-4 text-violet-600" />
        </div>
        <h2 className="text-base font-semibold text-foreground">Bonuses</h2>
        <div className="flex-1 h-px bg-border ml-2" />
      </div>

      {bonuses.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700">
            {totalBonusCount} bonus{totalBonusCount !== 1 ? "es" : ""} in period
          </span>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
            {formatGBP(totalBonusAmount)} total
          </span>
          {pendingBonusAmount > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
              {formatGBP(pendingBonusAmount)} pending
            </span>
          )}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <AgentBonusesTable bonuses={bonuses} commissionPercent={commissionPercent} isAdmin={isAdmin} />
        </CardContent>
      </Card>
    </div>
  );
}

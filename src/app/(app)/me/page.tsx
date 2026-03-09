import Link from "next/link";
import { requireUserProfile } from "@/lib/auth/requireRole";
import {
  getEarningsStatsForAgent,
  getEarningsTrendForAgent,
  getTransactions
} from "@/features/earnings/data/queries";
import { getAgentById } from "@/features/agents/data/agents";
import { getBonusesForAgent } from "@/features/bonuses/data/bonuses";
import { ProfileHeader } from "@/features/me/ui/ProfileHeader";
import { StatCard } from "@/features/me/ui/StatCard";
import { MeDateRangeFilter } from "@/features/me/ui/MeDateRangeFilter";
import { MeTrendChart } from "@/features/me/ui/MeTrendChart";
import { MeTransactionsTable } from "@/features/me/ui/MeTransactionsTable";
import { MeBonusesTable } from "@/features/me/ui/MeBonusesTable";
import { MeProfileSettingsForm } from "@/features/me/ui/MeProfileSettingsForm";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { formatGBP } from "@/lib/utils/formatters";
import {
  TrendingUp,
  Receipt,
  ClipboardList,
  Gift,
  Percent,
  Calculator
} from "lucide-react";

/** Default period: 11th of previous month → 10th of current month (or 10th of previous month if today < 11). */
function getDefaultRange() {
  const now = new Date();
  const day = now.getDate();
  const endDate =
    day >= 11
      ? new Date(now.getFullYear(), now.getMonth(), 10)
      : new Date(now.getFullYear(), now.getMonth() - 1, 10);
  const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 11);
  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10)
  };
}

export default async function MePage({
  searchParams
}: {
  searchParams?: { start?: string; end?: string; tab?: string };
}) {
  const profile = await requireUserProfile();
  const defaults = getDefaultRange();
  const start = searchParams?.start ?? defaults.start;
  const end = searchParams?.end ?? defaults.end;
  const filters = { from: start, to: end, payment_method: "all" as const };

  const [agentProfile, stats, trend, transactions, bonuses] = await Promise.all([
    getAgentById(profile.id).catch(() => null),
    getEarningsStatsForAgent(filters, profile.id),
    getEarningsTrendForAgent(filters, profile.id),
    getTransactions(filters, { agentId: profile.id }),
    getBonusesForAgent(profile.id, { from: start, to: end })
  ]);

  const totalBonuses = bonuses.reduce((sum, b) => sum + (b.amount_owed ?? 0), 0);
  const avgPerRental =
    (stats.totalTransactions ?? 0) > 0
      ? (stats.totalEarnings ?? 0) / (stats.totalTransactions ?? 1)
      : 0;

  const displayName = profile.display_name ?? agentProfile?.user_profiles?.display_name ?? "Agent";
  const role = profile.role ?? agentProfile?.user_profiles?.role ?? "agent";

  return (
    <div className="space-y-8">
      <ProfileHeader
        displayName={displayName}
        role={role}
        avatarUrl={agentProfile?.avatar_url}
        joinedAt={(profile as { created_at?: string }).created_at}
        editSupported={true}
      />

      <MeDateRangeFilter start={start} end={end} />

      <Tabs defaultValue={searchParams?.tab ?? "overview"} className="w-full" key={searchParams?.tab ?? "overview"}>
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="rentals">Rentals</TabsTrigger>
          <TabsTrigger value="bonuses">Bonuses</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 mt-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Total Earnings" value={formatGBP(stats.totalEarnings ?? 0)} icon={TrendingUp} />
            <StatCard label="Earnings (period)" value={formatGBP(stats.totalEarnings ?? 0)} icon={Receipt} iconColor="text-violet-600" iconBg="bg-violet-50" />
            <StatCard label="Total Rentals" value={stats.totalTransactions ?? 0} icon={ClipboardList} iconColor="text-blue-600" iconBg="bg-blue-50" />
            <StatCard label="Rentals (period)" value={stats.totalTransactions ?? 0} icon={ClipboardList} iconColor="text-slate-600" iconBg="bg-slate-50" />
            <StatCard label="Conversion" value="—" icon={Percent} iconColor="text-amber-600" iconBg="bg-amber-50" />
            <StatCard label="Avg per Rental" value={formatGBP(avgPerRental)} icon={Calculator} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
          </div>
          <MeTrendChart trend={trend} transactions={transactions} />
          <div className="rounded-bento bg-surface-card shadow-bento p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Transactions</h3>
            {transactions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-foreground-muted mb-4">No transactions in this date range.</p>
                <Button variant="outline" asChild>
                  <Link href="/me">Reset date range</Link>
                </Button>
              </div>
            ) : (
              <MeTransactionsTable transactions={transactions} />
            )}
          </div>
          <div className="rounded-bento bg-surface-card shadow-bento p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Bonuses</h3>
            <MeBonusesTable bonuses={bonuses} totalBonuses={totalBonuses} />
          </div>
        </TabsContent>

        <TabsContent value="earnings" className="space-y-8 mt-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Earnings" value={formatGBP(stats.totalEarnings ?? 0)} icon={TrendingUp} />
            <StatCard label="Earnings (period)" value={formatGBP(stats.totalEarnings ?? 0)} icon={Receipt} iconColor="text-violet-600" iconBg="bg-violet-50" />
            <StatCard label="Avg per Rental" value={formatGBP(avgPerRental)} icon={Calculator} />
          </div>
          <MeTrendChart trend={trend} transactions={transactions} />
        </TabsContent>

        <TabsContent value="rentals" className="space-y-8 mt-8">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Total Rentals" value={stats.totalTransactions ?? 0} icon={ClipboardList} iconColor="text-blue-600" iconBg="bg-blue-50" />
            <StatCard label="Rentals (period)" value={stats.totalTransactions ?? 0} icon={ClipboardList} iconColor="text-slate-600" iconBg="bg-slate-50" />
          </div>
          <div className="rounded-bento bg-surface-card shadow-bento p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Transactions</h3>
            {transactions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-foreground-muted mb-4">No transactions in this date range.</p>
                <Button variant="outline" asChild>
                  <Link href="/me">Reset date range</Link>
                </Button>
              </div>
            ) : (
              <MeTransactionsTable transactions={transactions} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="bonuses" className="space-y-8 mt-8">
          <StatCard label="Total Bonuses (period)" value={formatGBP(totalBonuses)} icon={Gift} iconColor="text-amber-600" iconBg="bg-amber-50" />
          <div className="rounded-bento bg-surface-card shadow-bento p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Bonuses</h3>
            <MeBonusesTable bonuses={bonuses} totalBonuses={totalBonuses} />
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-8 mt-8">
          <div className="rounded-bento bg-surface-card shadow-bento p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Profile &amp; security</h3>
            <MeProfileSettingsForm displayName={displayName} avatarUrl={agentProfile?.avatar_url} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

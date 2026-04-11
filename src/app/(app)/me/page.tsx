import Link from "next/link";
import { headers } from "next/headers";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
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

function getDefaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
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

  const headersList = headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const cardUrl = `${protocol}://${host}/public/card/${profile.id}`;

  const [agentProfile, stats, trend, transactions, bonuses, entitlements] = await Promise.all([
    getAgentById(profile.id).catch(() => null),
    getEarningsStatsForAgent(filters, profile.id),
    getEarningsTrendForAgent(filters, profile.id),
    getTransactions(filters, { agentId: profile.id }),
    getBonusesForAgent(profile.id, { from: start, to: end }),
    getEntitlements(),
  ]);

  const commissionPercent = agentProfile?.commission_percent ?? 50;
  const bonusAgentShare = (b: { amount_owed: number; payout_mode?: string | null }) =>
    b.payout_mode === "full" ? b.amount_owed : b.amount_owed * (commissionPercent / 100);
  const totalBonuses = bonuses.reduce((sum, b) => sum + bonusAgentShare(b), 0);
  const totalCombinedEarnings = (stats.totalEarnings ?? 0) + totalBonuses;
  const avgPerRental =
    (stats.totalTransactions ?? 0) > 0
      ? (stats.totalEarnings ?? 0) / (stats.totalTransactions ?? 1)
      : 0;

  const displayName = profile.display_name ?? agentProfile?.user_profiles?.display_name ?? "Agent";
  const role = profile.role ?? agentProfile?.user_profiles?.role ?? "agent";
  const isAdmin = profile.role.toLowerCase() === "admin";

  const hasBusinessCard = entitlements.has("digital_business_card");

  return (
    <div className="space-y-8">
      <ProfileHeader
        displayName={displayName}
        role={role}
        avatarUrl={agentProfile?.avatar_url}
        joinedAt={(profile as { created_at?: string }).created_at}
        editSupported={true}
        totalRentals={stats.totalTransactions ?? 0}
        totalEarnings={totalCombinedEarnings}
        avgPerRental={avgPerRental}
        cardUrl={cardUrl}
        hasBusinessCard={hasBusinessCard}
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
            <StatCard label="Total Earnings" value={formatGBP(totalCombinedEarnings)} icon={TrendingUp} />
            <StatCard label="Earnings (period)" value={formatGBP(totalCombinedEarnings)} icon={Receipt} iconColor="text-violet-600" iconBg="bg-violet-50" />
            <StatCard label="Total Rentals" value={stats.totalTransactions ?? 0} icon={ClipboardList} iconColor="text-blue-600" iconBg="bg-blue-50" />
            <StatCard label="Rentals (period)" value={stats.totalTransactions ?? 0} icon={ClipboardList} iconColor="text-slate-600" iconBg="bg-slate-50" />
            <StatCard label="Conversion" value="—" icon={Percent} iconColor="text-amber-600" iconBg="bg-amber-50" />
            <StatCard label="Avg per Rental" value={formatGBP(avgPerRental)} icon={Calculator} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
          </div>
          <MeTrendChart trend={trend} transactions={transactions} bonuses={bonuses} commissionPercent={commissionPercent} />
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
              <MeTransactionsTable transactions={transactions} isAdmin={isAdmin} />
            )}
          </div>
          <div className="rounded-bento bg-surface-card shadow-bento p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Bonuses</h3>
            <MeBonusesTable bonuses={bonuses} totalBonuses={totalBonuses} commissionPercent={commissionPercent} isAdmin={isAdmin} />
          </div>
        </TabsContent>

        <TabsContent value="earnings" className="space-y-8 mt-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Earnings" value={formatGBP(totalCombinedEarnings)} icon={TrendingUp} />
            <StatCard label="Earnings (period)" value={formatGBP(totalCombinedEarnings)} icon={Receipt} iconColor="text-violet-600" iconBg="bg-violet-50" />
            <StatCard label="Avg per Rental" value={formatGBP(avgPerRental)} icon={Calculator} />
          </div>
          <MeTrendChart trend={trend} transactions={transactions} bonuses={bonuses} commissionPercent={commissionPercent} />
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
              <MeTransactionsTable transactions={transactions} isAdmin={isAdmin} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="bonuses" className="space-y-8 mt-8">
          <StatCard label="Total Bonuses (period)" value={formatGBP(totalBonuses)} icon={Gift} iconColor="text-amber-600" iconBg="bg-amber-50" />
          <div className="rounded-bento bg-surface-card shadow-bento p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Bonuses</h3>
            <MeBonusesTable bonuses={bonuses} totalBonuses={totalBonuses} commissionPercent={commissionPercent} isAdmin={isAdmin} />
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-8 mt-8">
          <div className="rounded-bento bg-surface-card shadow-bento p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Profile &amp; security</h3>
            <MeProfileSettingsForm
              displayName={displayName}
              avatarUrl={agentProfile?.avatar_url}
              phone={agentProfile?.phone}
              contactEmail={agentProfile?.contact_email}
              facebookUrl={agentProfile?.facebook_url}
              instagramUrl={agentProfile?.instagram_url}
              linkedinUrl={agentProfile?.linkedin_url}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

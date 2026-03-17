import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAgentById } from "@/features/agents/data/agents";
import {
  getEarningsStatsForAgent,
  getEarningsTrendForAgent,
  getTransactions
} from "@/features/earnings/data/queries";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { canAccessRoute } from "@/lib/auth/roles";
import { AgentCommissionForm } from "@/features/agents/ui/AgentCommissionForm";
import { AvatarCircle } from "@/components/shared/AvatarCircle";
import { formatGBP, formatDate } from "@/lib/utils/formatters";
import { ArrowLeft, TrendingUp, ClipboardList } from "lucide-react";
import { AgentProfileCharts } from "@/features/earnings/ui/AgentProfileCharts";
import { AgentTransactionsTable } from "@/features/earnings/ui/AgentTransactionsTable";
import { AgentDisableToggle } from "@/features/agents/ui/AgentDisableToggle";

function getDefaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 90);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    payment_method: "all" as const
  };
}

export default async function AgentProfilePage({
  params,
  searchParams
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
        <p className="text-foreground-muted">You don’t have access to this profile.</p>
      </div>
    );
  }

  const agent = await getAgentById(params.id);
  const defaults = getDefaultRange();
  const filters = {
    from: searchParams?.from ?? defaults.from,
    to: searchParams?.to ?? defaults.to,
    payment_method: "all" as const
  };
  const minAmount = searchParams?.minAmount ? Number(searchParams.minAmount) : undefined;

  const [stats, trend, transactions] = await Promise.all([
    getEarningsStatsForAgent(filters, params.id),
    getEarningsTrendForAgent(filters, params.id),
    getTransactions(filters, { agentId: params.id })
  ]);

  const displayName = agent.user_profiles?.display_name ?? "Agent";
  const avgPerRental =
    (stats.totalTransactions ?? 0) > 0
      ? (stats.totalEarnings ?? 0) / (stats.totalTransactions ?? 1)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/earnings" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Earnings
            </Link>
          </Button>
        </div>
      </div>

      <PageHeader
        title={displayName}
        subtitle="Agent profile"
      />

      {/* Header: Avatar + stat chips */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-6 pt-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16">
              <AvatarCircle
                name={displayName}
                url={agent.avatar_url ?? undefined}
              />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{displayName}</h2>
              <p className="text-sm text-foreground-muted">
                {(() => {
                  const role = (agent.user_profiles?.role ?? "agent").toLowerCase();
                  if (role === "agent_and_marketing") return "Agent + Marketing";
                  if (role === "marketing_only") return "Marketing only";
                  if (role === "super_admin") return "Admin";
                  return role.charAt(0).toUpperCase() + role.slice(1);
                })()}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
              <TrendingUp className="h-3.5 w-3.5" />
              Total Earnings {formatGBP(stats.totalEarnings ?? 0)}
            </span>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700">
              Rentals: {stats.totalTransactions ?? 0}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
              Avg per rental {formatGBP(avgPerRental)}
            </span>
            {agent.commission_percent != null && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
                Commission {agent.commission_percent}%
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <AgentProfileCharts trend={trend} transactions={transactions} />

      {/* Transactions table */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Transactions</h3>
          <AgentTransactionsTable
            transactions={transactions}
            from={filters.from}
            to={filters.to}
            minAmount={minAmount}
          />
        </CardContent>
      </Card>

      {/* Admin-only: Role, Commission, Marketing, Form */}
      {isAdmin && (
        <>
          <Card>
            <CardContent className="grid gap-3 md:grid-cols-3 text-sm text-foreground-secondary pt-6">
              <div>
                <p className="text-xs uppercase text-foreground-muted">Role</p>
                <p>
                  {(() => {
                    const role = (agent.user_profiles?.role ?? "agent").toLowerCase();
                    if (role === "agent_and_marketing") return "Agent + Marketing";
                    if (role === "marketing_only") return "Marketing only";
                    if (role === "super_admin") return "Admin";
                    return role.charAt(0).toUpperCase() + role.slice(1);
                  })()}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-foreground-muted">Commission</p>
                <p>{agent.commission_percent}%</p>
              </div>
              <div>
                <p className="text-xs uppercase text-foreground-muted">Marketing fee</p>
                <p>£{agent.marketing_fee}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-foreground-muted">Status</p>
                <p className="mb-2">
                  {agent.is_disabled ? "Disabled" : "Active"}
                </p>
                <AgentDisableToggle userId={agent.user_id} isDisabled={Boolean(agent.is_disabled)} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 pt-6">
              <p className="text-sm font-medium text-brand">Admin-only updates</p>
              <AgentCommissionForm
                userId={agent.user_id}
                commission_percent={agent.commission_percent}
                marketing_fee={agent.marketing_fee}
                role={(agent.user_profiles as { role?: string } | null)?.role ?? "agent"}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

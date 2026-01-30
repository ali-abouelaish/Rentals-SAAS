import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureTenantSetup } from "@/features/tenants/actions/tenants";
import { getLedgerTotals, getLedgerTotalsForAgent } from "@/features/ledger/data/ledger";
import { getRecentActivity } from "@/features/activity/data/activity";
import { getLastNDays, toISODate } from "@/lib/utils/dates";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { EarningsChart } from "@/features/agents/ui/EarningsChart";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    await ensureTenantSetup(user.id, user.email ?? undefined);
  }

  const [totals, activity] = await Promise.all([
    getLedgerTotals(),
    getRecentActivity(8)
  ]);

  const agentTotals = user ? await getLedgerTotalsForAgent(user.id) : { earnings: 0, revenue: 0 };

  const last30Days = getLastNDays(30);
  const { data: ledgerRows } = await supabase
    .from("ledger_entries")
    .select("created_at, agent_earning_gbp")
    .gte("created_at", toISODate(last30Days[0]));

  const dailyMap = new Map<string, number>();
  ledgerRows?.forEach((row) => {
    const dateKey = toISODate(new Date(row.created_at));
    dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + (row.agent_earning_gbp ?? 0));
  });

  const chartData = last30Days.map((day) => ({
    date: day.toLocaleDateString("en-GB", { month: "short", day: "2-digit" }),
    earnings: dailyMap.get(toISODate(day)) ?? 0
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Agency performance & recent activity" />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total agency revenue" value={formatCurrency(totals.revenue)} />
        <StatCard label="Agent earnings" value={formatCurrency(agentTotals.earnings)} />
        <StatCard label="Agency earnings" value={formatCurrency(totals.revenue - totals.earnings)} />
      </div>

      <Card>
        <CardContent className="space-y-4">
          <p className="text-sm font-medium text-navy">Earnings over last 30 days</p>
          <EarningsChart data={chartData} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <p className="text-sm font-medium text-navy">Recent activity</p>
          <ul className="space-y-2 text-sm text-gray-600">
            {activity.map((item) => (
              <li key={item.id} className="flex items-center justify-between">
                <span>{item.action.replace("_", " ")}</span>
                <span className="text-xs text-gray-400">
                  {formatDate(item.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

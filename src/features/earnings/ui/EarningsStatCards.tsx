import { StatCard } from "@/components/shared/StatCard";
import { formatGBP } from "@/lib/utils/formatters";
import type { EarningsStats } from "../domain/types";

export function EarningsStatCards({ stats }: { stats: EarningsStats }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <StatCard label="Total agents" value={stats.totalAgents.toString()} />
      <StatCard label="Total earnings" value={formatGBP(stats.totalEarnings)} />
      <StatCard label="Total transactions" value={stats.totalTransactions.toString()} />
      <StatCard label="Avg per agent" value={formatGBP(stats.avgPerAgent)} />
    </div>
  );
}

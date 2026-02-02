import { StatCard } from "@/components/shared/StatCard";
import { formatGBP } from "@/lib/utils/formatters";

export function CommissionSummaryCards({
  rentalsCount,
  agentEarnings,
  bonusesEarnings,
  totalPayouts,
  overdueAmount,
  overdueCount,
  agencyNet
}: {
  rentalsCount: number;
  agentEarnings: number;
  bonusesEarnings: number;
  totalPayouts: number;
  overdueAmount: number;
  overdueCount: number;
  agencyNet: number;
}) {
  const totalOwed = agentEarnings + bonusesEarnings;
  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Approved rentals" value={`${rentalsCount}`} />
      <StatCard label="Agent earnings owed" value={formatGBP(totalOwed)} />
      <StatCard label="Bonuses owed" value={formatGBP(bonusesEarnings)} />
      <StatCard label="Paid to agent" value={formatGBP(totalPayouts)} />
      <StatCard
        label="Overdue"
        value={formatGBP(overdueAmount)}
        helper={overdueCount > 0 ? `${overdueCount} items older than 7 days` : "—"}
      />
      <StatCard label="Agency net" value={formatGBP(agencyNet)} />
    </div>
  );
}

"use client";

import { formatGBP, formatDate } from "@/lib/utils/formatters";
import { BonusPaidToggle } from "@/features/bonuses/ui/BonusPaidToggle";

type BonusRow = {
  id: string;
  bonus_date: string;
  client_name: string;
  amount_owed: number;
  payout_mode?: string | null;
  status: string;
  created_at: string;
};

type MeBonusesTableProps = {
  bonuses: BonusRow[];
  totalBonuses: number;
  commissionPercent: number;
  isAdmin?: boolean;
};

function agentShare(b: BonusRow, commissionPercent: number): number {
  if (b.payout_mode === "full") return b.amount_owed;
  return b.amount_owed * (commissionPercent / 100);
}

export function MeBonusesTable({ bonuses, totalBonuses, commissionPercent, isAdmin = false }: MeBonusesTableProps) {
  if (bonuses.length === 0) {
    return (
      <p className="text-sm text-foreground-muted py-8 text-center">No bonuses in this period.</p>
    );
  }

  const outstanding = bonuses.reduce(
    (sum, b) => (b.status === "paid" ? sum : sum + agentShare(b, commissionPercent)),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-foreground-muted font-medium">
              <th className="pb-3 pr-4">Date</th>
              <th className="pb-3 pr-4">Type / Client</th>
              <th className="pb-3 pr-4">Paid</th>
              <th className="pb-3 pl-4 text-right tabular-nums">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bonuses.map((b) => (
              <tr key={b.id} className="border-b border-border/60">
                <td className="py-3 pr-4 text-foreground-muted">{formatDate(b.bonus_date)}</td>
                <td className="py-3 pr-4">
                  {b.client_name || "—"}
                </td>
                <td className="py-3 pr-4">
                  <BonusPaidToggle bonusId={b.id} status={b.status} isAdmin={isAdmin} />
                </td>
                <td className="py-3 pl-4 text-right tabular-nums font-medium">
                  {formatGBP(agentShare(b, commissionPercent))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <td className="pt-3 pr-4 text-foreground-muted" colSpan={3}>
                Total bonuses ({bonuses.length} {bonuses.length === 1 ? "bonus" : "bonuses"})
              </td>
              <td className="pt-3 pl-4 text-right tabular-nums">{formatGBP(totalBonuses)}</td>
            </tr>
            <tr className="font-semibold">
              <td className="pb-3 pr-4 text-foreground-muted" colSpan={3}>
                Outstanding (unpaid)
              </td>
              <td className="pb-3 pl-4 text-right tabular-nums text-amber-600">
                {formatGBP(outstanding)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

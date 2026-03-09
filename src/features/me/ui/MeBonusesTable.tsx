import { formatGBP, formatDate } from "@/lib/utils/formatters";

type BonusRow = {
  id: string;
  bonus_date: string;
  client_name: string;
  amount_owed: number;
  status: string;
  created_at: string;
};

type MeBonusesTableProps = {
  bonuses: BonusRow[];
  totalBonuses: number;
};

export function MeBonusesTable({ bonuses, totalBonuses }: MeBonusesTableProps) {
  if (bonuses.length === 0) {
    return (
      <p className="text-sm text-foreground-muted py-8 text-center">No bonuses in this period.</p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground">
        Total bonuses: {formatGBP(totalBonuses)}
      </p>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-foreground-muted font-medium">
              <th className="pb-3 pr-4">Date</th>
              <th className="pb-3 pr-4">Type / Client</th>
              <th className="pb-3 pl-4 text-right tabular-nums">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bonuses.map((b) => (
              <tr key={b.id} className="border-b border-border/60">
                <td className="py-3 pr-4 text-foreground-muted">{formatDate(b.bonus_date)}</td>
                <td className="py-3 pr-4">
                  <span className="capitalize">{b.status}</span>
                  {b.client_name ? ` · ${b.client_name}` : ""}
                </td>
                <td className="py-3 pl-4 text-right tabular-nums font-medium">
                  {formatGBP(b.amount_owed)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

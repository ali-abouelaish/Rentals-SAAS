import { formatGBP, formatDate } from "@/lib/utils/formatters";

type BonusRow = {
  id: string;
  bonus_date: string;
  client_name: string;
  property_address?: string | null;
  amount_owed: number;
  payout_mode?: string | null;
  status: string;
};

function agentShare(b: BonusRow, commissionPercent: number): number {
  if (b.payout_mode === "full") return b.amount_owed;
  return b.amount_owed * (commissionPercent / 100);
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-blue-50 text-blue-700",
  sent: "bg-blue-50 text-blue-700",
  paid: "bg-emerald-50 text-emerald-700",
  declined: "bg-red-50 text-red-700",
};

export function AgentBonusesTable({
  bonuses,
  commissionPercent,
  isAdmin = false,
}: {
  bonuses: BonusRow[];
  commissionPercent: number;
  isAdmin?: boolean;
}) {
  if (bonuses.length === 0) {
    return (
      <p className="text-sm text-foreground-muted py-10 text-center">
        No bonuses in this period.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-foreground-muted font-medium">
            <th className="pb-3 pr-4">Date</th>
            <th className="pb-3 pr-4">Client</th>
            <th className="pb-3 pr-4">Property</th>
            <th className="pb-3 pr-4 text-right tabular-nums">{isAdmin ? "Agent Share" : "Your Share"}</th>
            <th className="pb-3 pl-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {bonuses.map((b) => (
            <tr key={b.id} className="border-b border-border/60">
              <td className="py-3 pr-4 text-foreground-muted whitespace-nowrap">
                {formatDate(b.bonus_date)}
              </td>
              <td className="py-3 pr-4 font-medium">{b.client_name}</td>
              <td className="py-3 pr-4 text-foreground-muted">
                {b.property_address ?? "—"}
              </td>
              <td className="py-3 pr-4 text-right tabular-nums font-medium">
                {formatGBP(agentShare(b, commissionPercent))}
              </td>
              <td className="py-3 pl-4">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[b.status] ?? "bg-surface-inset text-foreground-muted"}`}
                >
                  {b.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

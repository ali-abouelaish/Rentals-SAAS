import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import type { CommissionBonusRow } from "../data/queries";
import { markBonusPaid } from "../actions/bonuses";

export function BonusesTable({ bonuses }: { bonuses: CommissionBonusRow[] }) {
  return (
    <DataTable
      columns={[
        "Bonus",
        "Landlord",
        "Amount Owed",
        "Payout Mode",
        "Agent Earning",
        "Status",
        "Created",
        "Actions"
      ]}
      rows={bonuses.map((bonus) => [
        <span key={`${bonus.id}-code`} className="text-sm text-navy">
          {bonus.code ?? "—"}
        </span>,
        <span key={`${bonus.id}-landlord`} className="text-sm text-gray-600">
          {bonus.landlord_name}
        </span>,
        <span key={`${bonus.id}-amount`} className="text-sm text-gray-600">
          {formatGBP(bonus.amount_owed)}
        </span>,
        <span key={`${bonus.id}-mode`} className="text-sm text-gray-600">
          {bonus.payout_mode}
        </span>,
        <span key={`${bonus.id}-earning`} className="text-sm font-medium text-navy">
          {formatGBP(bonus.agent_earning)}
        </span>,
        <StatusBadge key={`${bonus.id}-status`} status={bonus.status} />,
        <span key={`${bonus.id}-created`} className="text-sm text-gray-500">
          {formatDate(bonus.created_at)}
        </span>,
        ["approved", "sent"].includes(bonus.status) ? (
          <form key={`${bonus.id}-action`} action={markBonusPaid.bind(null, bonus.id)}>
            <Button type="submit" variant="outline" size="sm">
              Mark Paid
            </Button>
          </form>
        ) : (
          <span key={`${bonus.id}-action`} className="text-xs text-gray-400">
            —
          </span>
        )
      ])}
    />
  );
}

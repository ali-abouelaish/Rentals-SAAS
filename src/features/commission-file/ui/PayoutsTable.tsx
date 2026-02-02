import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import type { CommissionPayoutRow } from "../data/queries";
import { createAgentPayout } from "../actions/payouts";

export function PayoutsTable({
  payouts,
  agentId
}: {
  payouts: CommissionPayoutRow[];
  agentId: string;
}) {
  return (
    <div className="space-y-4">
      <form action={createAgentPayout} className="grid gap-2 md:grid-cols-4">
        <input type="hidden" name="agent_id" value={agentId} />
        <Input name="amount_gbp" type="number" step="0.01" placeholder="Amount (£)" required />
        <Input name="payout_date" type="date" required />
        <Input name="notes" placeholder="Notes (optional)" />
        <div className="md:col-span-1">
          <Button type="submit" variant="secondary">
            Add payout
          </Button>
        </div>
      </form>

      <DataTable
        columns={["Date", "Amount", "Notes"]}
        rows={payouts.map((payout) => [
          <span key={`${payout.id}-date`} className="text-sm text-gray-600">
            {formatDate(payout.payout_date)}
          </span>,
          <span key={`${payout.id}-amount`} className="text-sm font-medium text-navy">
            {formatGBP(payout.amount_gbp)}
          </span>,
          <span key={`${payout.id}-notes`} className="text-sm text-gray-500">
            {payout.notes ?? "—"}
          </span>
        ])}
      />
    </div>
  );
}

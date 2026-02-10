import Link from "next/link";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import type { CommissionRentalRow } from "../data/queries";
import { Button } from "@/components/ui/button";

export function RentalsTable({
  rentals,
  totals,
  agentId,
  from,
  to,
  includeAllStatuses
}: {
  rentals: CommissionRentalRow[];
  totals: {
    rental_amount: number;
    payment_fee: number;
    base_amount: number;
    marketing_fee_deducted: number;
    agent_earning: number;
  };
  agentId: string;
  from: string;
  to: string;
  includeAllStatuses: boolean;
}) {
  const baseParams = new URLSearchParams({ from, to });
  const approvedUrl = `/admin/agents/${agentId}/commission?${baseParams.toString()}`;
  const allParams = new URLSearchParams({ from, to, status: "all" });
  const allUrl = `/admin/agents/${agentId}/commission?${allParams.toString()}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button asChild variant={includeAllStatuses ? "outline" : "secondary"} size="sm">
            <Link href={approvedUrl}>Approved only</Link>
          </Button>
          <Button asChild variant={includeAllStatuses ? "secondary" : "outline"} size="sm">
            <Link href={allUrl}>Include paid/refunded</Link>
          </Button>
        </div>
        <Button type="button" variant="outline" size="sm" disabled>
          Export CSV (soon)
        </Button>
      </div>

      <DataTable
        columns={[
          "Date",
          "Code",
          "Client",
          "Property",
          "Payment",
          "Rental",
          "Fee",
          "Base",
          "Commission %",
          "Marketing Agent",
          "Marketing Fee",
          "Agent Earning",
          "Status",
          "Link"
        ]}
        rows={[
          ...rentals.map((rental) => [
            <span key={`${rental.id}-date`} className="text-sm text-foreground-secondary">
              {formatDate(rental.created_at)}
            </span>,
            <span key={`${rental.id}-code`} className="text-sm text-navy">
              {rental.code}
            </span>,
            <div key={`${rental.id}-client`} className="text-sm">
              <p className="text-navy">{rental.client_name}</p>
              <p className="text-xs text-foreground-secondary">{rental.client_phone}</p>
            </div>,
            <span key={`${rental.id}-property`} className="text-sm text-foreground-secondary">
              {rental.property_address}
            </span>,
            <span key={`${rental.id}-payment`} className="text-sm text-foreground-secondary">
              {rental.payment_method}
            </span>,
            <span key={`${rental.id}-amount`} className="text-sm text-foreground-secondary">
              {formatGBP(rental.rental_amount)}
            </span>,
            <span key={`${rental.id}-fee`} className="text-sm text-foreground-secondary">
              {formatGBP(rental.payment_fee)}
            </span>,
            <span key={`${rental.id}-base`} className="text-sm text-foreground-secondary">
              {formatGBP(rental.base_amount)}
            </span>,
            <span key={`${rental.id}-commission`} className="text-sm text-foreground-secondary">
              {rental.commission_percent}%
            </span>,
            <span key={`${rental.id}-marketing`} className="text-sm text-foreground-secondary">
              {rental.marketing_agent_name}
            </span>,
            <span key={`${rental.id}-marketing-fee`} className="text-sm text-foreground-secondary">
              {formatGBP(rental.marketing_fee_deducted)}
            </span>,
            <span key={`${rental.id}-earning`} className="text-sm font-medium text-navy">
              {formatGBP(rental.agent_earning)}
            </span>,
            <StatusBadge key={`${rental.id}-status`} status={rental.status} />,
            <Link key={`${rental.id}-link`} href={`/rentals/${rental.id}`} className="text-navy">
              View
            </Link>
          ]),
          [
            <span key="total-label" className="text-sm font-medium text-navy">
              Totals
            </span>,
            <span key="total-code">—</span>,
            <span key="total-client">—</span>,
            <span key="total-property">—</span>,
            <span key="total-payment">—</span>,
            <span key="total-amount" className="text-sm font-medium text-navy">
              {formatGBP(totals.rental_amount)}
            </span>,
            <span key="total-fee" className="text-sm font-medium text-navy">
              {formatGBP(totals.payment_fee)}
            </span>,
            <span key="total-base" className="text-sm font-medium text-navy">
              {formatGBP(totals.base_amount)}
            </span>,
            <span key="total-commission">—</span>,
            <span key="total-marketing">—</span>,
            <span key="total-marketing-fee" className="text-sm font-medium text-navy">
              {formatGBP(totals.marketing_fee_deducted)}
            </span>,
            <span key="total-earning" className="text-sm font-medium text-navy">
              {formatGBP(totals.agent_earning)}
            </span>,
            <span key="total-status">—</span>,
            <span key="total-link">—</span>
          ]
        ]}
      />
    </div>
  );
}

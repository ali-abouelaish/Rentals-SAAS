"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { formatGBP, formatDate } from "@/lib/utils/formatters";
import { BonusPaidToggle } from "./BonusPaidToggle";

type LinkedInvoice = {
  id: string;
  invoice_number: string | null;
  status: string | null;
};

type BonusRow = {
  id: string;
  bonus_date: string;
  client_name: string;
  property_address?: string | null;
  landlord_name?: string | null;
  amount_owed: number;
  payout_mode?: string | null;
  status: string;
  invoice?: LinkedInvoice | null;
};

function agentShare(b: BonusRow, commissionPercent: number): number {
  if (b.payout_mode === "full") return b.amount_owed;
  return b.amount_owed * (commissionPercent / 100);
}

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

  const totalShare = bonuses.reduce(
    (sum, b) => sum + agentShare(b, commissionPercent),
    0,
  );
  const outstanding = bonuses.reduce(
    (sum, b) => (b.status === "paid" ? sum : sum + agentShare(b, commissionPercent)),
    0,
  );

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-foreground-muted font-medium">
            <th className="pb-3 pr-4">Date</th>
            <th className="pb-3 pr-4">Client</th>
            <th className="pb-3 pr-4">Landlord</th>
            <th className="pb-3 pr-4">Property</th>
            <th className="pb-3 pr-4 text-right tabular-nums">{isAdmin ? "Agent Share" : "Your Share"}</th>
            <th className="pb-3 pr-4">Invoice</th>
            <th className="pb-3 pl-4">Paid</th>
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
                {b.landlord_name ?? "—"}
              </td>
              <td className="py-3 pr-4 text-foreground-muted">
                {b.property_address ?? "—"}
              </td>
              <td className="py-3 pr-4 text-right tabular-nums font-medium">
                {formatGBP(agentShare(b, commissionPercent))}
              </td>
              <td className="py-3 pr-4">
                {b.invoice ? (
                  <Link
                    href={`/invoices/${b.invoice.id}`}
                    title={`Open invoice ${b.invoice.invoice_number ?? ""}${
                      b.invoice.status ? ` (${b.invoice.status})` : ""
                    }`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-brand hover:bg-surface-highlight transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">
                      {b.invoice.invoice_number ?? "Invoice"}
                    </span>
                  </Link>
                ) : (
                  <span className="text-foreground-muted">—</span>
                )}
              </td>
              <td className="py-3 pl-4">
                <BonusPaidToggle bonusId={b.id} status={b.status} isAdmin={isAdmin} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-semibold">
            <td className="pt-3 pr-4 text-foreground-muted" colSpan={4}>
              Total ({bonuses.length} {bonuses.length === 1 ? "bonus" : "bonuses"})
            </td>
            <td className="pt-3 pr-4 text-right tabular-nums">
              {formatGBP(totalShare)}
            </td>
            <td className="pt-3 pr-4" />
            <td className="pt-3 pl-4" />
          </tr>
          <tr className="font-semibold">
            <td className="pb-3 pr-4 text-foreground-muted" colSpan={4}>
              Outstanding (unpaid)
            </td>
            <td className="pb-3 pr-4 text-right tabular-nums text-amber-600">
              {formatGBP(outstanding)}
            </td>
            <td className="pb-3 pr-4" />
            <td className="pb-3 pl-4" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

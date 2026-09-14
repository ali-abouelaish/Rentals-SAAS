import { Receipt } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { formatPence } from "@/lib/envelopes/packs";
import type { MyInvoice } from "../data/platformInvoices";

const STATUS_STYLE: Record<MyInvoice["status"], string> = {
  issued: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  void: "bg-neutral-200 text-neutral-500 line-through"
};

const STATUS_HELP: Record<MyInvoice["status"], string> = {
  issued: "Raised and not yet settled.",
  paid: "Settled — nothing outstanding.",
  void: "Cancelled. You do not owe this."
};

function shortDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function MyInvoicesCard({ invoices }: { invoices: MyInvoice[] }) {
  if (invoices.length === 0) return null;

  const outstanding = invoices
    .filter((invoice) => invoice.status === "issued")
    .reduce((sum, invoice) => sum + invoice.totalPence, 0);

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-brand" aria-hidden />
            <h2 className="text-sm font-medium text-foreground">Your invoices</h2>
          </div>
          {outstanding > 0 && (
            <Tooltip content="Invoices raised and not yet settled. We will be in touch about payment — nothing is taken automatically.">
              <span className="text-xs text-foreground-secondary cursor-help">
                {formatPence(outstanding)} outstanding
              </span>
            </Tooltip>
          )}
        </div>

        <p className="text-xs text-foreground-secondary">
          What Harbor Ops has charged your agency for paid integrations and envelope
          top-ups. No payment is taken automatically.
        </p>

        <div className="space-y-2">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {invoice.periodLabel}
                  </p>
                  <p className="text-[11px] text-foreground-muted">
                    {invoice.issuedAt && <>Issued {shortDate(invoice.issuedAt)}</>}
                    {invoice.paidAt && <> · paid {shortDate(invoice.paidAt)}</>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip content={STATUS_HELP[invoice.status]}>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium cursor-help",
                        STATUS_STYLE[invoice.status]
                      )}
                    >
                      {invoice.status}
                    </span>
                  </Tooltip>
                  <span className="text-sm font-semibold text-foreground">
                    {formatPence(invoice.totalPence)}
                  </span>
                </div>
              </div>

              {invoice.lines.length > 0 && (
                <div className="mt-2 border-t border-border pt-2 space-y-0.5">
                  {invoice.lines.map((line) => (
                    <div
                      key={line.id}
                      className="flex items-center justify-between gap-3 text-[11px]"
                    >
                      <span className="text-foreground-secondary">{line.description}</span>
                      <span className="font-medium text-foreground">
                        {formatPence(line.amountPence)}
                      </span>
                    </div>
                  ))}
                  {invoice.vatPence > 0 && (
                    <div className="flex items-center justify-between gap-3 text-[11px] pt-1">
                      <span className="text-foreground-muted">VAT</span>
                      <span className="text-foreground-secondary">
                        {formatPence(invoice.vatPence)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

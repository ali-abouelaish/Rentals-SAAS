"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, ChevronRight, Download, RefreshCw } from "lucide-react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { formatPence } from "@/lib/envelopes/packs";
import { AddAdjustmentDialog } from "./AddAdjustmentDialog";
import { EmailInvoiceDialog } from "./EmailInvoiceDialog";
import type { PlatformBillingSummary, PlatformInvoiceRow } from "../data/billing";
import {
  exportInvoicePdfAction,
  generateInvoicesAction,
  issueInvoiceAction,
  markInvoicePaidAction,
  voidInvoiceAction,
} from "../actions/billing";

const STATUS_STYLE: Record<PlatformInvoiceRow["status"], string> = {
  draft: "bg-neutral-200 text-neutral-700",
  issued: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  void: "bg-neutral-200 text-neutral-500 line-through",
};

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PlatformBillingManager({
  summary,
  year,
  month,
  periodLabel,
}: {
  summary: PlatformBillingSummary;
  year: number;
  month: number;
  periodLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);

  const run = (action: () => Promise<Result>) => {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  };

  /**
   * Download the PDF.
   *
   * The action returns a signed URL rather than bytes — a server action
   * serialises through the RSC payload, so returning a megabyte of PDF would be
   * slow and still need turning into a blob here. `link.click()` rather than
   * `window.open` because the URL carries a download disposition, and a popup
   * blocker would otherwise eat it.
   */
  const downloadPdf = (invoiceId: string) => {
    startTransition(async () => {
      const result = await exportInvoicePdfAction({ invoiceId });
      if ("error" in result) {
        toast.error("Could not build the PDF", { description: result.error });
        return;
      }
      const link = document.createElement("a");
      link.href = result.url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  };

  const goToPeriod = (deltaMonths: number) => {
    const next = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
    router.push(
      `/admin/billing?year=${next.getUTCFullYear()}&month=${next.getUTCMonth() + 1}`
    );
  };

  const outstanding = summary.draftTotalPence + summary.issuedTotalPence;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => goToPeriod(-1)}>
            ← Previous
          </Button>
          <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">
            {periodLabel}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => goToPeriod(1)}>
            Next →
          </Button>
        </div>

        <Tooltip content="Builds drafts from active subscriptions and unbilled envelope purchases. Rebuilds existing drafts; never touches an invoice that's already issued or paid. Safe to press twice.">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={isPending}
            onClick={() => run(() => generateInvoicesAction({ year, month }))}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Generate drafts
          </Button>
        </Tooltip>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Draft", value: summary.draftTotalPence },
          { label: "Issued, unpaid", value: summary.issuedTotalPence },
          { label: "Paid", value: summary.paidTotalPence },
          { label: "Outstanding", value: outstanding },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg bg-surface-inset p-2.5">
            <p className="text-lg font-semibold text-foreground leading-none">
              {formatPence(stat.value)}
            </p>
            <p className="text-[11px] text-foreground-muted mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {summary.invoices.length === 0 ? (
        <p className="text-xs text-foreground-secondary">
          No invoices for {periodLabel}. Press <strong>Generate drafts</strong> to build
          them — agencies with nothing to bill are skipped rather than given a £0 invoice.
        </p>
      ) : (
        <div className="space-y-2">
          {summary.invoices.map((invoice) => {
            const isOpen = expanded === invoice.id;
            return (
              <div
                key={invoice.id}
                className="rounded-xl border border-border bg-surface-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : invoice.id)}
                    className="flex items-start gap-2 min-w-0 text-left"
                    aria-expanded={isOpen}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 mt-0.5 text-foreground-muted" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-foreground-muted" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {invoice.tenant.name}
                        {invoice.invoice_number && (
                          <span className="ml-2 font-normal text-[11px] text-foreground-muted">
                            {invoice.invoice_number}
                          </span>
                        )}
                      </span>
                      <span className="block text-[11px] text-foreground-muted mt-0.5">
                        {invoice.lines.length} line{invoice.lines.length === 1 ? "" : "s"}
                        {invoice.issued_at && <> · issued {formatDate(invoice.issued_at)}</>}
                        {invoice.paid_at && <> · paid {formatDate(invoice.paid_at)}</>}
                        {invoice.emailed_at && <> · emailed {formatDate(invoice.emailed_at)}</>}
                      </span>
                      {/* An issued invoice nobody has sent is the quiet failure
                          here — it looks handled on screen while the agency has
                          never seen it. */}
                      {invoice.status === "issued" && !invoice.emailed_at && (
                        <span className="block text-[11px] text-amber-700 mt-0.5">
                          Not emailed yet
                        </span>
                      )}
                      {invoice.email_error && (
                        <span className="flex items-center gap-1 text-[11px] text-red-600 mt-0.5">
                          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                          Last send failed: {invoice.email_error}
                        </span>
                      )}
                    </span>
                  </button>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                        STATUS_STYLE[invoice.status]
                      )}
                    >
                      {invoice.status}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatPence(invoice.total_pence)}
                    </span>

                    <Tooltip content="Download the PDF. A draft downloads stamped DRAFT, so figures can be reviewed before issuing.">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={isPending}
                        onClick={() => downloadPdf(invoice.id)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </Tooltip>

                    {/* Only once issued. A draft gets rebuilt by the generator,
                        so emailing one puts a figure in somebody's inbox that
                        we are about to change. */}
                    {(invoice.status === "issued" || invoice.status === "paid") && (
                      <EmailInvoiceDialog
                        invoiceId={invoice.id}
                        agencyName={invoice.tenant.name}
                        invoiceNumber={invoice.invoice_number}
                        periodLabel={periodLabel}
                        defaultEmail={invoice.billing_email}
                        alreadySentTo={invoice.emailed_to}
                        sentAt={invoice.emailed_at}
                      />
                    )}

                    <Tooltip content="Every invoice, subscription, envelope purchase and usage count for this agency.">
                      <Link
                        href={`/admin/tenants/${invoice.tenant.id}/billing`}
                        className="text-[11px] font-medium text-foreground-secondary hover:text-foreground hover:underline"
                      >
                        History
                      </Link>
                    </Tooltip>

                    {invoice.status === "draft" && (
                      <AddAdjustmentDialog
                        invoiceId={invoice.id}
                        tenantName={invoice.tenant.name}
                        currentTotalPence={invoice.total_pence}
                      />
                    )}

                    {invoice.status === "draft" && (
                      <Tooltip content="Makes this the agency's bill. They can see it from this point; it stops being rebuilt by the generator.">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          loading={isPending}
                          onClick={() => run(() => issueInvoiceAction({ invoiceId: invoice.id }))}
                        >
                          Issue
                        </Button>
                      </Tooltip>
                    )}

                    {invoice.status === "issued" && (
                      <Tooltip content="Record that the agency has settled this.">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          loading={isPending}
                          onClick={() =>
                            run(() => markInvoicePaidAction({ invoiceId: invoice.id }))
                          }
                        >
                          Mark paid
                        </Button>
                      </Tooltip>
                    )}

                    {invoice.status !== "void" && (
                      <Tooltip content="Cancels this invoice. Any envelope purchases on it go back in the pool and appear on the next run.">
                        <button
                          type="button"
                          onClick={() => run(() => voidInvoiceAction({ invoiceId: invoice.id }))}
                          className="text-[11px] font-medium text-red-600 hover:text-red-700 hover:underline"
                        >
                          Void
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-border px-3 py-2">
                    {invoice.lines.map((line) => (
                      <div
                        key={line.id}
                        className="flex items-center justify-between gap-3 py-1 text-[11px]"
                      >
                        <span className="text-foreground-secondary">
                          {line.description}
                          <span className="text-foreground-muted"> · {line.kind}</span>
                        </span>
                        <span className="text-foreground font-medium">
                          {formatPence(line.amount_pence)}
                        </span>
                      </div>
                    ))}
                    <div className="mt-1 pt-1 border-t border-border flex items-center justify-between text-[11px]">
                      <span className="text-foreground-muted">
                        Subtotal {formatPence(invoice.subtotal_pence)}
                        {invoice.vat_pence > 0 && <> · VAT {formatPence(invoice.vat_pence)}</>}
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatPence(invoice.total_pence)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Result = { error: string } | { success: true; message: string };

import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { getTenantDetails } from "@/features/admin/data/admin";
import { getAgencyBillingHistory } from "@/features/admin/data/billing";
import { formatPence } from "@/lib/envelopes/packs";
import { cn } from "@/lib/utils/cn";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-neutral-200 text-neutral-700",
  issued: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  void: "bg-neutral-200 text-neutral-500 line-through"
};

function shortDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function monthOf(periodStart: string): string {
  return new Date(`${periodStart}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

export default async function TenantBillingPage({
  params
}: {
  params: { tenantId: string };
}) {
  const [tenant, history] = await Promise.all([
    getTenantDetails(params.tenantId),
    getAgencyBillingHistory(params.tenantId)
  ]);

  if (!tenant) notFound();

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${tenant.name} — Billing`}
        subtitle="Every invoice, subscription, envelope purchase and usage count for this agency."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/tenants/${params.tenantId}`}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" aria-hidden />
              Back to agency
            </Link>
          </Button>
        }
      />

      {history.unavailable.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <div className="text-sm">
                <p className="font-medium text-foreground">Some sections are missing</p>
                <p className="text-foreground-secondary mt-1">
                  Could not read: {history.unavailable.join(", ")}. Apply the outstanding
                  migrations and reload.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Current MRR",
            value: formatPence(history.mrrPence),
            tooltip:
              "Sum of this agency's active, non-grandfathered subscriptions at the price each was frozen at when activated."
          },
          {
            label: "Outstanding",
            value: formatPence(history.outstandingPence),
            tooltip: "Issued invoices not yet marked paid, across every period."
          },
          {
            label: "Paid to date",
            value: formatPence(history.lifetimePaidPence),
            tooltip: "Everything this agency has settled since they joined."
          }
        ].map((tile) => (
          <Tooltip key={tile.label} content={tile.tooltip}>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-foreground-muted">
                  {tile.label}
                </p>
                <p className="text-2xl font-bold text-foreground mt-1">{tile.value}</p>
              </CardContent>
            </Card>
          </Tooltip>
        ))}
      </div>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <h2 className="text-base font-semibold text-foreground">Subscriptions</h2>
          {history.subscriptions.length === 0 ? (
            <p className="text-sm text-foreground-secondary">
              No integration subscriptions. This agency is on the included features only.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Integration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Billing from</TableHead>
                    <TableHead>Ends</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.subscriptions.map((sub) => (
                    <TableRow key={sub.integrationKey}>
                      <TableCell className="text-sm text-foreground">
                        {sub.name}
                        {sub.blockedOnUs && (
                          <Tooltip content="This scheme issues credentials per agency and only a super admin can apply them. The agency cannot clear this themselves — it is waiting on us.">
                            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 cursor-help">
                              waiting on us
                            </span>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-foreground-secondary">
                        {sub.status.replaceAll("_", " ")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {sub.isGrandfathered ? (
                          <Tooltip content="Kept free when paid integrations were introduced. Charging them now would break the promise the grandfathering migration made.">
                            <span className="text-foreground-muted cursor-help">
                              grandfathered
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="text-foreground">
                            {formatPence(sub.monthlyPricePence)}/mo
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-foreground-secondary">
                        {shortDate(sub.billingStartsOn)}
                      </TableCell>
                      <TableCell className="text-xs text-foreground-secondary">
                        {shortDate(sub.endsOn)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <h2 className="text-base font-semibold text-foreground">Invoices</h2>
          {history.invoices.length === 0 ? (
            <p className="text-sm text-foreground-secondary">
              No invoices raised yet. Agencies with nothing to bill are skipped rather than
              given a £0 invoice.
            </p>
          ) : (
            <div className="space-y-2">
              {history.invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {invoice.period_label}
                      </p>
                      <p className="text-[11px] text-foreground-muted">
                        {invoice.lines.length} line{invoice.lines.length === 1 ? "" : "s"}
                        {invoice.issued_at && <> · issued {shortDate(invoice.issued_at)}</>}
                        {invoice.paid_at && <> · paid {shortDate(invoice.paid_at)}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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
                    </div>
                  </div>

                  {invoice.lines.length > 0 && (
                    <div className="mt-2 border-t border-border pt-2 space-y-0.5">
                      {invoice.lines.map((line) => (
                        <div
                          key={line.id}
                          className="flex items-center justify-between gap-3 text-[11px]"
                        >
                          <span className="text-foreground-secondary">
                            {line.description}
                            <span className="text-foreground-muted"> · {line.kind}</span>
                          </span>
                          <span className="font-medium text-foreground">
                            {formatPence(line.amount_pence)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Metered usage</h2>
            <Tooltip content="Counted from what the platform already records, once a month, after the month closes. Every overage rate is currently zero, so these numbers are measured but not charged.">
              <span className="text-[11px] text-foreground-muted cursor-help">
                measured, not charged
              </span>
            </Tooltip>
          </div>
          {history.usage.length === 0 ? (
            <p className="text-sm text-foreground-secondary">
              No usage counted yet. The rollup runs on the 1st and measures the month that
              just closed.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Meter</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Included</TableHead>
                    <TableHead>Over</TableHead>
                    <TableHead>Charged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.usage.map((row) => (
                    <TableRow key={`${row.periodStart}:${row.meterKey}`}>
                      <TableCell className="text-xs text-foreground-secondary whitespace-nowrap">
                        {monthOf(row.periodStart)}
                      </TableCell>
                      <TableCell className="text-xs text-foreground">{row.name}</TableCell>
                      <TableCell className="text-xs text-foreground">
                        {row.quantity.toLocaleString("en-GB")}
                      </TableCell>
                      <TableCell className="text-xs text-foreground-secondary">
                        {row.included.toLocaleString("en-GB")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.billable > 0 ? (
                          <span className="text-amber-700 font-medium">
                            {row.billable.toLocaleString("en-GB")}
                          </span>
                        ) : (
                          <span className="text-foreground-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
                        {formatPence(row.amountPence)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {history.purchases.length > 0 && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              Envelope top-ups
            </h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purchased</TableHead>
                    <TableHead>Envelopes</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Bills in</TableHead>
                    <TableHead>Invoiced</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="text-xs text-foreground-secondary whitespace-nowrap">
                        {shortDate(purchase.purchasedAt)}
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
                        {purchase.envelopes}
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
                        {formatPence(purchase.pricePence)}
                      </TableCell>
                      <TableCell className="text-xs text-foreground-secondary whitespace-nowrap">
                        {monthOf(purchase.billingPeriod)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {purchase.invoicedAt ? (
                          <span className="text-foreground-secondary">
                            {shortDate(purchase.invoicedAt)}
                          </span>
                        ) : (
                          <Tooltip content="Not yet on an invoice. The next generation run for its billing month will pick it up.">
                            <span className="text-amber-700 cursor-help">pending</span>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

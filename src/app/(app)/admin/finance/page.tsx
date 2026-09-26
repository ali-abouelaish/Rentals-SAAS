import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { getPlatformFinance } from "@/features/admin/data/finance";
import { PlatformFinanceChart } from "@/features/admin/ui/PlatformFinanceChart";
import { ExpenseDialog } from "@/features/admin/ui/ExpenseDialog";
import { ExpenseList } from "@/features/admin/ui/ExpenseList";
import { formatPence } from "@/lib/envelopes/packs";
import { cn } from "@/lib/utils/cn";

/**
 * Harbor Ops' own P&L.
 *
 * Revenue is what agencies are billed (tenant_platform_invoices); expenses are
 * what it costs us to run (platform_expenses). Deliberately NOT the agency-facing
 * /finances page, which is an agency's portfolio P&L — see the migration header
 * for why the two are separate.
 */

function resolvePeriod(searchParams: { year?: string; month?: string }) {
  const year = Number(searchParams.year);
  const month = Number(searchParams.month);

  const valid =
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    year >= 2024 &&
    year <= 2100 &&
    month >= 1 &&
    month <= 12;

  const now = new Date();
  // A mistyped URL falls back to this month rather than erroring — same as the
  // billing screen.
  return valid
    ? { year, month }
    : { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export default async function AdminFinancePage({
  searchParams
}: {
  searchParams: { year?: string; month?: string; months?: string };
}) {
  const { year, month } = resolvePeriod(searchParams);
  const months = Number(searchParams.months) || 12;

  const finance = await getPlatformFinance({ year, month, months });
  const { current, totals } = finance;

  const prev = new Date(Date.UTC(year, month - 2, 1));
  const next = new Date(Date.UTC(year, month, 1));
  const periodHref = (d: Date) =>
    `/admin/finance?year=${d.getUTCFullYear()}&month=${d.getUTCMonth() + 1}&months=${months}`;

  const isProfit = current.netPence >= 0;

  const tiles = [
    {
      label: "Revenue invoiced",
      value: formatPence(current.invoicedPence),
      helper: `${formatPence(current.collectedPence)} collected`,
      tooltip:
        "Issued and paid invoices for this month. Drafts are excluded — they have not been sent and may still change. Profit below is calculated against this figure."
    },
    {
      label: "Expenses",
      value: formatPence(current.expensesPence),
      helper: `${formatPence(finance.runRatePence)} monthly run rate`,
      tooltip:
        "Everything that applies to this month: recurring costs, one-offs incurred in it, and a slice of anything amortised. Run rate counts only the standing recurring costs."
    },
    {
      label: isProfit ? "Net profit" : "Net loss",
      value: formatPence(Math.abs(current.netPence)),
      helper:
        finance.marginPercent === null
          ? "No revenue this month"
          : `${finance.marginPercent}% margin`,
      tooltip:
        "Revenue invoiced minus expenses. An accrual figure — it counts money billed, not money in the bank.",
      emphasis: isProfit ? ("good" as const) : ("bad" as const)
    },
    {
      label: "Outstanding",
      value: formatPence(current.invoicedPence - current.collectedPence),
      helper: "Invoiced but not yet collected",
      tooltip:
        "The gap between what was billed for this month and what has been marked paid. No payment processor is involved, so an invoice only becomes 'collected' when somebody records it."
    }
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Finance"
        subtitle="What Harbor Ops earns against what it costs to run."
        action={<ExpenseDialog />}
      />

      {finance.unavailable.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <div className="text-sm">
                <p className="font-medium text-foreground">Some figures are incomplete</p>
                <p className="text-foreground-secondary mt-1">
                  Could not read: {finance.unavailable.join(", ")}. If this is{" "}
                  <code>platform_expenses</code>, apply{" "}
                  <code>20260915000001_platform_expenses.sql</code> — until then every
                  month shows zero costs and the profit figure is overstated.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={periodHref(prev)}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" aria-hidden />
              Previous
            </Link>
          </Button>
          <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">
            {finance.periodLabel}
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link href={periodHref(next)}>
              Next
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" aria-hidden />
            </Link>
          </Button>
        </div>

        <div className="flex rounded-lg border border-border overflow-hidden">
          {[6, 12, 24].map((option) => (
            <Link
              key={option}
              href={`/admin/finance?year=${year}&month=${month}&months=${option}`}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                months === option
                  ? "bg-brand text-brand-fg"
                  : "text-foreground-secondary hover:bg-surface-inset"
              )}
            >
              {option}m
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Tooltip key={tile.label} content={tile.tooltip}>
            <Card
              className={cn(
                "h-full",
                tile.emphasis === "bad" && "border-red-300",
                tile.emphasis === "good" && "border-emerald-300"
              )}
            >
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-foreground-muted">
                  {tile.label}
                </p>
                <p
                  className={cn(
                    "text-2xl font-bold mt-1 tabular-nums",
                    tile.emphasis === "bad"
                      ? "text-red-600"
                      : tile.emphasis === "good"
                        ? "text-emerald-700"
                        : "text-foreground"
                  )}
                >
                  {tile.emphasis === "bad" ? "−" : ""}
                  {tile.value}
                </p>
                <p className="text-xs text-foreground-secondary mt-1">{tile.helper}</p>
              </CardContent>
            </Card>
          </Tooltip>
        ))}
      </div>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand" aria-hidden />
              <h2 className="text-base font-semibold text-foreground">
                Last {months} months
              </h2>
            </div>
            <p className="text-xs text-foreground-secondary">
              {formatPence(totals.invoicedPence)} invoiced ·{" "}
              {formatPence(totals.expensesPence)} costs ·{" "}
              <span
                className={cn(
                  "font-semibold",
                  totals.netPence >= 0 ? "text-emerald-700" : "text-red-600"
                )}
              >
                {totals.netPence < 0 ? "−" : ""}
                {formatPence(Math.abs(totals.netPence))} net
              </span>
            </p>
          </div>

          <PlatformFinanceChart series={finance.series} />
        </CardContent>
      </Card>

      {finance.breakdown.length > 0 && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              Where {finance.periodLabel} went
            </h2>
            <div className="space-y-2">
              {finance.breakdown.map((row) => (
                <div key={row.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{row.label}</span>
                    <span className="text-foreground-secondary tabular-nums">
                      {formatPence(row.amountPence)} · {row.share}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-inset overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.max(row.share, 1)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">Expenses</h2>
            <p className="text-xs text-foreground-muted">
              Amount shown is for {finance.periodLabel}
            </p>
          </div>
          <ExpenseList expenses={finance.expenses} periodLabel={finance.periodLabel} />
        </CardContent>
      </Card>
    </div>
  );
}

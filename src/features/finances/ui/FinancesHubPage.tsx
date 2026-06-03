import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileSpreadsheet,
  Banknote,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "./MonthPicker";
import { PostRecurringButton } from "./PostRecurringButton";
import type { FinanceMonthRollup } from "../domain/types";
import type { MonthPostInfo } from "../data/entries";

export type MonthCloseInfo = {
  status: "open" | "in_review" | "closed";
  closed_at: string | null;
  closed_by_name: string | null;
};

function formatPounds(pence: number): string {
  const pounds = Math.round(pence / 100);
  return `£${pounds.toLocaleString()}`;
}

function StatCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "success" | "muted";
  hint?: string;
}) {
  const valueClass =
    tone === "danger"
      ? "text-red-600"
      : tone === "success"
        ? "text-emerald-600"
        : tone === "muted"
          ? "text-foreground-muted"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-foreground-muted font-semibold">
        {label}
      </p>
      <p className={`text-2xl font-bold tracking-tight mt-1 tabular-nums ${valueClass}`}>
        {value}
      </p>
      {hint ? (
        <p className="text-[11px] text-foreground-secondary mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

export function FinancesHubPage({
  rollup,
  postInfo,
  closeInfo,
}: {
  rollup: FinanceMonthRollup;
  postInfo: MonthPostInfo;
  closeInfo: MonthCloseInfo;
}) {
  const collectionRate =
    rollup.rent_expected > 0
      ? Math.round((rollup.rent_received / rollup.rent_expected) * 100)
      : null;

  const netTone: "success" | "danger" | "default" =
    rollup.net_profit > 0 ? "success" : rollup.net_profit < 0 ? "danger" : "default";

  const isClosed = closeInfo.status === "closed";
  const isPosted = postInfo.count > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
          <Wallet className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Finances</h1>
            {isClosed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-semibold text-foreground border border-border">
                <Lock className="h-3 w-3" />
                Closed
              </span>
            ) : null}
          </div>
          <p className="text-xs text-foreground-secondary truncate">
            {rollup.month_label} · portfolio-wide P&amp;L (cash basis)
          </p>
        </div>
        <MonthPicker value={rollup.month_key} />
      </div>

      {/* Materialization status + actions */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-card px-3 py-2">
        {isPosted ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-secondary">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>
              {postInfo.count} entr{postInfo.count === 1 ? "y" : "ies"} posted
              {postInfo.last_posted_at
                ? ` · last ${new Date(postInfo.last_posted_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`
                : ""}
              {postInfo.posted_by_name ? ` by ${postInfo.posted_by_name}` : ""}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-secondary">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span>No entries posted to the ledger yet for this month.</span>
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <PostRecurringButton
            year={rollup.year}
            month={rollup.month}
            posted={isPosted}
            disabled={isClosed || rollup.is_future_month}
          />
        </div>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/finances/overheads">Admin overheads</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/finances/tenant-charges">Tenant charges</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/finances/close?month=${rollup.month_key}`}>
            {isClosed ? "View close summary" : "Monthly close"}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/rent-collection/statements">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Bank statements
          </Link>
        </Button>
      </div>

      {rollup.is_future_month ? (
        <div className="rounded-xl border border-border bg-surface-card p-4 text-xs text-foreground-secondary">
          This month hasn&apos;t started yet. Expected income reflects projected contracts;
          received income, costs, and net profit will populate as the month progresses.
        </div>
      ) : null}

      {/* Headline stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Rent received"
          value={formatPounds(rollup.rent_received)}
          tone="success"
          hint={
            collectionRate !== null
              ? `${collectionRate}% of £${Math.round(rollup.rent_expected / 100).toLocaleString()} expected`
              : undefined
          }
        />
        <StatCard
          label="Outstanding"
          value={formatPounds(rollup.rent_outstanding)}
          tone={rollup.rent_outstanding > 0 ? "danger" : "success"}
          hint={
            rollup.tenant_charges_expected > 0
              ? `+ ${formatPounds(rollup.tenant_charges_expected)} tenant charges expected`
              : rollup.rent_outstanding > 0
                ? "Expected minus received"
                : "Fully collected"
          }
        />
        <StatCard
          label="Total costs"
          value={formatPounds(rollup.total_costs)}
          tone="default"
          hint={`Owner ${formatPounds(rollup.owner_rent)} + property ${formatPounds(rollup.property_costs)} + admin ${formatPounds(rollup.admin_overheads)}`}
        />
        <StatCard
          label="Net profit"
          value={formatPounds(rollup.net_profit)}
          tone={netTone}
          hint={
            rollup.is_current_month
              ? `Includes ${formatPounds(rollup.vacancy_loss)} vacancy loss`
              : "Cash basis"
          }
        />
      </div>

      {/* Bank reconciliation */}
      <div className="rounded-xl border border-border bg-surface-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <Banknote className="h-4 w-4 text-foreground-muted" />
          <h2 className="text-sm font-semibold text-foreground">Bank reconciliation</h2>
          {rollup.bank_credits_unmatched > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
              <AlertTriangle className="h-3 w-3" />
              {formatPounds(rollup.bank_credits_unmatched)} unmatched
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-foreground-muted">Credits total</p>
            <p className="font-semibold tabular-nums text-foreground mt-0.5">
              {formatPounds(rollup.bank_credits_total)}
            </p>
          </div>
          <div>
            <p className="text-foreground-muted">Matched to contracts</p>
            <p className="font-semibold tabular-nums text-foreground mt-0.5">
              {formatPounds(rollup.bank_credits_matched)}
            </p>
          </div>
          <div>
            <p className="text-foreground-muted">Unmatched / flagged</p>
            <p className="font-semibold tabular-nums text-foreground mt-0.5">
              {formatPounds(rollup.bank_credits_unmatched)}
            </p>
          </div>
        </div>
        {rollup.bank_credits_total === 0 ? (
          <p className="text-[11px] text-foreground-secondary mt-2">
            No bank statement uploaded for this month yet.{" "}
            <Link href="/rent-collection/statements" className="underline">
              Upload one
            </Link>{" "}
            to reconcile rent receipts against your bank feed.
          </p>
        ) : null}
      </div>

      {/* Two-column: cost breakdown + portfolio breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Costs by category */}
        <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Costs by category</h2>
          </div>
          {rollup.costs_by_category.length === 0 ? (
            <p className="px-4 py-6 text-xs text-foreground-secondary text-center">
              No costs recorded for this month.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rollup.costs_by_category.map((c) => (
                <li
                  key={c.key}
                  className="flex items-center justify-between px-4 py-2.5 text-xs"
                >
                  <span className="text-foreground">{c.label}</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatPounds(c.amount)}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between px-4 py-2.5 text-xs bg-surface-inset">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-bold tabular-nums text-foreground">
                  {formatPounds(rollup.total_costs)}
                </span>
              </li>
            </ul>
          )}
        </div>

        {/* By portfolio */}
        <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">By portfolio</h2>
          </div>
          {rollup.by_portfolio.length === 0 ? (
            <p className="px-4 py-6 text-xs text-foreground-secondary text-center">
              No portfolios with activity this month.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rollup.by_portfolio.map((p) => (
                <li key={p.portfolio_id} className="px-4 py-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: p.portfolio_color }}
                      />
                      {p.portfolio_name}
                    </span>
                    <span
                      className={`font-semibold tabular-nums inline-flex items-center gap-1 ${
                        p.net_profit > 0
                          ? "text-emerald-600"
                          : p.net_profit < 0
                            ? "text-red-600"
                            : "text-foreground"
                      }`}
                    >
                      {p.net_profit > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : p.net_profit < 0 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : null}
                      {formatPounds(p.net_profit)}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-foreground-secondary">
                    <span>
                      Received:{" "}
                      <span className="text-foreground font-medium tabular-nums">
                        {formatPounds(p.rent_received)}
                      </span>
                    </span>
                    <span>
                      Costs:{" "}
                      <span className="text-foreground font-medium tabular-nums">
                        {formatPounds(p.property_costs + p.owner_rent)}
                      </span>
                    </span>
                    <span>
                      Expected:{" "}
                      <span className="text-foreground font-medium tabular-nums">
                        {formatPounds(p.rent_expected)}
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* By property */}
      <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">By property</h2>
          <span className="text-[11px] text-foreground-muted">
            {rollup.by_property.length} propert{rollup.by_property.length === 1 ? "y" : "ies"}
          </span>
        </div>
        {rollup.by_property.length === 0 ? (
          <p className="px-4 py-6 text-xs text-foreground-secondary text-center">
            No properties in this tenant yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-inset">
                <tr className="text-left text-[11px] uppercase tracking-wider text-foreground-muted">
                  <th className="px-4 py-2 font-semibold">Property</th>
                  <th className="px-4 py-2 font-semibold">Portfolio</th>
                  <th className="px-4 py-2 font-semibold text-right">Received</th>
                  <th className="px-4 py-2 font-semibold text-right">Expected</th>
                  <th className="px-4 py-2 font-semibold text-right">Owner rent</th>
                  <th className="px-4 py-2 font-semibold text-right">Costs</th>
                  <th className="px-4 py-2 font-semibold text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rollup.by_property.map((p) => (
                  <tr key={p.property_id}>
                    <td className="px-4 py-2 text-foreground">
                      <Link
                        href={`/profitability/${p.property_id}`}
                        className="hover:underline"
                      >
                        {p.property_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5 text-foreground-secondary">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: p.portfolio_color }}
                        />
                        {p.portfolio_name}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground">
                      {formatPounds(p.rent_received)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground-secondary">
                      {formatPounds(p.rent_expected)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground-secondary">
                      {formatPounds(p.owner_rent)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground-secondary">
                      {formatPounds(p.property_costs)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums font-semibold ${
                        p.net_profit > 0
                          ? "text-emerald-600"
                          : p.net_profit < 0
                            ? "text-red-600"
                            : "text-foreground"
                      }`}
                    >
                      {formatPounds(p.net_profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-foreground-secondary">
        Net profit uses cash basis: rent received − owner rent − property costs
        {rollup.is_current_month ? " − current-month vacancy loss" : ""}. Admin overheads,
        recurring tenant charges, and monthly close are coming in upcoming phases.
      </p>
    </div>
  );
}

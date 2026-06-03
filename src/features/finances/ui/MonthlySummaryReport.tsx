import Link from "next/link";
import { ClipboardCheck, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MonthlyClose } from "../domain/closes";

function formatPounds(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString()}`;
}

function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function MonthlySummaryReport({
  close,
  closedByName,
}: {
  close: MonthlyClose;
  closedByName: string | null;
}) {
  const snapshot = close.snapshot;
  const label = monthLabel(close.year, close.month);
  const monthKey = `${close.year}-${String(close.month).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
          <ClipboardCheck className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Monthly Summary · {label}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-semibold text-foreground border border-border">
              <Lock className="h-3 w-3" />
              Closed
            </span>
          </div>
          <p className="text-xs text-foreground-secondary">
            Frozen snapshot · closed{" "}
            {close.closed_at
              ? new Date(close.closed_at).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—"}
            {closedByName ? ` by ${closedByName}` : ""}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/finances?month=${monthKey}`}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to hub
          </Link>
        </Button>
      </div>

      {/* Print-friendly header (only shows in print) */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">Monthly Summary · {label}</h1>
        <p className="text-xs text-foreground-secondary mt-1">
          Closed{" "}
          {close.closed_at
            ? new Date(close.closed_at).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "—"}
          {closedByName ? ` by ${closedByName}` : ""}
        </p>
      </div>

      {!snapshot ? (
        <div className="rounded-xl border border-border bg-surface-card p-6 text-sm text-foreground-secondary">
          This close has no snapshot. It may have been reopened.
        </div>
      ) : (
        <>
          {/* Headline */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Mini label="Rent received" value={formatPounds(snapshot.rent_received)} />
            <Mini label="Outstanding" value={formatPounds(snapshot.rent_outstanding)} />
            <Mini label="Total costs" value={formatPounds(snapshot.total_costs)} />
            <Mini
              label="Net profit"
              value={formatPounds(snapshot.net_profit)}
              tone={snapshot.net_profit < 0 ? "danger" : "success"}
            />
          </div>

          {/* Income detail */}
          <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Income</h2>
            </div>
            <ul className="divide-y divide-border">
              <Row label="Rent expected" amount={snapshot.rent_expected} />
              <Row label="Rent received" amount={snapshot.rent_received} bold />
              <Row label="Outstanding rent" amount={snapshot.rent_outstanding} />
              <Row
                label="Tenant recurring charges expected"
                amount={snapshot.tenant_charges_expected}
              />
            </ul>
          </div>

          {/* Costs detail */}
          <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Costs</h2>
            </div>
            <ul className="divide-y divide-border">
              {snapshot.costs_by_category.length === 0 ? (
                <li className="px-4 py-3 text-xs text-foreground-secondary">No costs recorded.</li>
              ) : (
                snapshot.costs_by_category.map((c) => (
                  <Row key={c.key} label={c.label} amount={c.amount} />
                ))
              )}
              <Row label="Total costs" amount={snapshot.total_costs} bold />
            </ul>
          </div>

          {/* By portfolio */}
          <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">By portfolio</h2>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-surface-inset">
                <tr className="text-left text-[11px] uppercase tracking-wider text-foreground-muted">
                  <th className="px-4 py-2 font-semibold">Portfolio</th>
                  <th className="px-4 py-2 font-semibold text-right">Received</th>
                  <th className="px-4 py-2 font-semibold text-right">Owner rent</th>
                  <th className="px-4 py-2 font-semibold text-right">Costs</th>
                  <th className="px-4 py-2 font-semibold text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {snapshot.by_portfolio.map((p) => (
                  <tr key={p.portfolio_id}>
                    <td className="px-4 py-2 text-foreground">{p.portfolio_name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPounds(p.rent_received)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPounds(p.owner_rent)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPounds(p.property_costs)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums font-semibold ${
                        p.net_profit < 0 ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {formatPounds(p.net_profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By property */}
          <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">By property</h2>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-surface-inset">
                <tr className="text-left text-[11px] uppercase tracking-wider text-foreground-muted">
                  <th className="px-4 py-2 font-semibold">Property</th>
                  <th className="px-4 py-2 font-semibold">Portfolio</th>
                  <th className="px-4 py-2 font-semibold text-right">Received</th>
                  <th className="px-4 py-2 font-semibold text-right">Owner rent</th>
                  <th className="px-4 py-2 font-semibold text-right">Costs</th>
                  <th className="px-4 py-2 font-semibold text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {snapshot.by_property.map((p) => (
                  <tr key={p.property_id}>
                    <td className="px-4 py-2 text-foreground">{p.property_name}</td>
                    <td className="px-4 py-2 text-foreground-secondary">{p.portfolio_name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPounds(p.rent_received)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPounds(p.owner_rent)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatPounds(p.property_costs)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums font-semibold ${
                        p.net_profit < 0 ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {formatPounds(p.net_profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  label,
  amount,
  bold,
}: {
  label: string;
  amount: number;
  bold?: boolean;
}) {
  return (
    <li
      className={`flex items-center justify-between px-4 py-2.5 text-xs ${
        bold ? "bg-surface-inset" : ""
      }`}
    >
      <span className={bold ? "font-semibold text-foreground" : "text-foreground"}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold" : "font-semibold"} text-foreground`}>
        {formatPounds(amount)}
      </span>
    </li>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success";
}) {
  const cls =
    tone === "danger"
      ? "text-red-600"
      : tone === "success"
        ? "text-emerald-600"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-foreground-muted font-semibold">
        {label}
      </p>
      <p className={`text-2xl font-bold tracking-tight mt-1 tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

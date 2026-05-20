"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { StatementTransaction } from "../data/queries";
import { formatPence, formatShortDate } from "./bank-meta";

type FilterKey = "all" | "credit" | "debit";

const TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "credit", label: "Credits" },
  { key: "debit", label: "Debits" },
];

function MatchBadge({ tx }: { tx: StatementTransaction }) {
  if (tx.transaction_type !== "credit") {
    return <span className="text-xs text-foreground-muted">—</span>;
  }
  if (tx.match_status === "matched") {
    return (
      <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
        Matched — {tx.matched_tenant_name ?? "tenant"}
      </span>
    );
  }
  if (tx.match_status === "flagged") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        Flagged — review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-inset px-2 py-0.5 text-[10px] font-semibold text-foreground-secondary">
      Unmatched
    </span>
  );
}

export function TransactionFeed({ transactions }: { transactions: StatementTransaction[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return transactions;
    return transactions.filter((tx) => tx.transaction_type === filter);
  }, [filter, transactions]);

  const counts = useMemo(() => {
    return {
      all: transactions.length,
      credit: transactions.filter((tx) => tx.transaction_type === "credit").length,
      debit: transactions.filter((tx) => tx.transaction_type === "debit").length,
    };
  }, [transactions]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-inset w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              filter === tab.key
                ? "bg-surface-card text-foreground shadow-sm"
                : "text-foreground-secondary hover:text-foreground",
            )}
          >
            {tab.label}
            <span className="ml-1.5 text-foreground-muted tabular-nums">{counts[tab.key]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card py-10 text-center">
          <p className="text-sm text-foreground-secondary">No transactions to show.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-inset text-[11px] uppercase tracking-wider text-foreground-muted font-semibold">
                <tr>
                  <th className="text-left px-4 py-2.5">Date</th>
                  <th className="text-left px-4 py-2.5">Description</th>
                  <th className="text-right px-4 py-2.5">Amount</th>
                  <th className="text-left px-4 py-2.5">Type</th>
                  <th className="text-left px-4 py-2.5">Match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((tx) => {
                  const isCredit = tx.transaction_type === "credit";
                  return (
                    <tr key={tx.id} className="hover:bg-surface-inset transition-colors">
                      <td className="px-4 py-2.5 text-foreground-secondary text-xs tabular-nums">
                        {formatShortDate(tx.transaction_date)}
                      </td>
                      <td className="px-4 py-2.5 text-foreground text-xs max-w-[420px] truncate">
                        {tx.description ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                        <span className={isCredit ? "text-success" : "text-foreground"}>
                          {isCredit ? "+" : "−"}
                          {formatPence(tx.amount_pence)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[11px] font-medium",
                            isCredit ? "text-success" : "text-foreground-secondary",
                          )}
                        >
                          {isCredit ? (
                            <ArrowDownLeft className="h-3 w-3" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                          {isCredit ? "Credit" : "Debit"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <MatchBadge tx={tx} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

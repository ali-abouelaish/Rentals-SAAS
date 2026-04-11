"use client";

import { formatGBP, formatDate } from "@/lib/utils/formatters";
import { PaidToggle } from "./PaidToggle";
import { BonusPaidToggle } from "@/features/bonuses/ui/BonusPaidToggle";
import type { PaymentRow } from "../domain/types";

type Props = {
  payments: PaymentRow[];
  statusFilter: "all" | "paid" | "unpaid";
  from: string;
  to: string;
  isAdmin: boolean;
};

export function PaymentsTracker({ payments, statusFilter, from, to, isAdmin }: Props) {
  const baseHref = `/earnings?from=${from}&to=${to}&tab=payments`;

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2">
        {(["all", "unpaid", "paid"] as const).map((f) => (
          <a
            key={f}
            href={`${baseHref}&status=${f}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
              statusFilter === f
                ? "bg-foreground text-background"
                : "bg-surface-inset text-foreground-muted hover:bg-surface-inset/80"
            }`}
          >
            {f === "all" ? "All" : f === "unpaid" ? "Unpaid" : "Paid"}
          </a>
        ))}
      </div>

      {payments.length === 0 ? (
        <p className="text-sm text-foreground-muted py-8 text-center">
          No {statusFilter !== "all" ? statusFilter : ""} payments in this period.
        </p>
      ) : (
        <>
          <p className="text-sm text-foreground-muted">
            {payments.length} payment{payments.length !== 1 ? "s" : ""} &middot;{" "}
            Total: {formatGBP(payments.reduce((s, p) => s + p.amount, 0))}
          </p>

          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-foreground-muted font-medium">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Code</th>
                  <th className="pb-3 pr-4">Client</th>
                  <th className="pb-3 pr-4">Agent</th>
                  <th className="pb-3 pr-4 text-right tabular-nums">Amount</th>
                  <th className="pb-3 pl-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={`${p.type}-${p.id}`} className="border-b border-border/60">
                    <td className="py-3 pr-4 text-foreground-muted whitespace-nowrap">
                      {formatDate(p.date)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.type === "rental"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}
                      >
                        {p.type === "rental" ? "Rental" : "Bonus"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-medium">{p.code || "—"}</td>
                    <td className="py-3 pr-4">{p.client_name}</td>
                    <td className="py-3 pr-4 text-foreground-muted">{p.agent_name}</td>
                    <td className="py-3 pr-4 text-right tabular-nums font-medium">
                      {formatGBP(p.amount)}
                    </td>
                    <td className="py-3 pl-4">
                      {p.type === "rental" ? (
                        <PaidToggle rentalId={p.id} status={p.status} isAdmin={isAdmin} />
                      ) : (
                        <BonusPaidToggle bonusId={p.id} status={p.status} isAdmin={isAdmin} />
                      )}
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

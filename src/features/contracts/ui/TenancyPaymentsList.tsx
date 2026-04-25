"use client";

import { useEffect, useState } from "react";
import { PoundSterling } from "lucide-react";
import { getRentPaymentsForContract, type RentPayment } from "../actions/rent-payments";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function formatPaidAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function tenancyMonths(start: string, end: string | null): number {
  const startMs = Date.parse(start);
  const endMs = end ? Date.parse(end) : Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.round((endMs - startMs) / (30.44 * 86_400_000)));
}

export function TenancyPaymentsList({
  contractId,
  rentPence,
  startDate,
  endDate,
}: {
  contractId: string;
  rentPence: number;        // whole pounds, despite the name
  startDate: string;
  endDate: string | null;
}) {
  const [payments, setPayments] = useState<RentPayment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPayments(null);
    setError(null);
    getRentPaymentsForContract(contractId)
      .then((p) => { if (!cancelled) setPayments(p); })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load payments");
      });
    return () => { cancelled = true; };
  }, [contractId]);

  if (error) {
    return <p className="text-xs text-red-600">{error}</p>;
  }

  if (!payments) {
    return (
      <div className="space-y-1.5">
        <div className="h-7 rounded bg-surface-inset animate-pulse" />
        <div className="h-7 rounded bg-surface-inset animate-pulse" />
      </div>
    );
  }

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const monthsActive = tenancyMonths(startDate, endDate);
  const expected = monthsActive * rentPence;
  const balance = expected - totalPaid;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-foreground-muted flex items-center gap-1">
          <PoundSterling className="h-3 w-3" />
          Rent payments ({payments.length})
        </p>
        <div className="flex items-center gap-3 tabular-nums">
          <span className="text-foreground-muted">
            Paid <span className="font-medium text-foreground">£{totalPaid.toLocaleString()}</span>
          </span>
          {expected > 0 && (
            <span
              className={
                balance > 0
                  ? "text-red-600 font-medium"
                  : balance < 0
                    ? "text-emerald-600 font-medium"
                    : "text-foreground-muted"
              }
            >
              {balance > 0
                ? `£${balance.toLocaleString()} short`
                : balance < 0
                  ? `£${Math.abs(balance).toLocaleString()} ahead`
                  : "On track"}
            </span>
          )}
        </div>
      </div>

      {payments.length === 0 ? (
        <p className="text-foreground-muted italic">No rent recorded for this tenancy.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface-inset/40 overflow-hidden">
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {MONTHS[p.period_month - 1]} {p.period_year}
                </p>
                <p className="text-[10px] text-foreground-muted">
                  Paid {formatPaidAt(p.paid_at)}
                  {p.notes ? ` · ${p.notes}` : ""}
                </p>
              </div>
              <span className="tabular-nums font-medium text-foreground">
                £{Number(p.amount).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

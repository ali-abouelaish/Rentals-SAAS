"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatGBP, formatDate } from "@/lib/utils/formatters";
import type { EarningsTransaction } from "../domain/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PaidToggle } from "./PaidToggle";

export function AgentTransactionsTable({
  transactions,
  from,
  to,
  minAmount,
  isAdmin = false,
}: {
  transactions: EarningsTransaction[];
  from: string;
  to: string;
  minAmount?: number;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtered = minAmount
    ? transactions.filter((t) => t.amount >= minAmount)
    : transactions;

  const applyFilters = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fromVal = (form.querySelector('[name="from"]') as HTMLInputElement)?.value;
    const toVal = (form.querySelector('[name="to"]') as HTMLInputElement)?.value;
    const minVal = (form.querySelector('[name="minAmount"]') as HTMLInputElement)?.value;
    const params = new URLSearchParams();
    if (fromVal) params.set("from", fromVal);
    if (toVal) params.set("to", toVal);
    if (minVal && Number(minVal) > 0) params.set("minAmount", minVal);
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={applyFilters}
        className="flex flex-wrap items-end gap-3 pb-4 border-b border-border"
      >
        <div className="flex items-center gap-2">
          <label className="text-xs text-foreground-muted">From</label>
          <Input type="date" name="from" defaultValue={from} className="w-36 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-foreground-muted">To</label>
          <Input type="date" name="to" defaultValue={to} className="w-36 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-foreground-muted">Min amount (£)</label>
          <Input
            type="number"
            name="minAmount"
            defaultValue={minAmount ?? ""}
            placeholder="0"
            min={0}
            step={10}
            className="w-28 text-sm"
          />
        </div>
        <Button type="submit" size="sm">
          Apply
        </Button>
      </form>

      {filtered.length === 0 ? (
        <p className="text-sm text-foreground-muted py-8 text-center">
          No transactions in this range.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-foreground-muted font-medium">
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Rental Code</th>
                <th className="pb-3 pr-4">Client</th>
                <th className="pb-3 pr-4">Paid</th>
                <th className="pb-3 pr-4">Payment method</th>
                <th className="pb-3 pr-4 text-right tabular-nums">Consultation fee</th>
                <th className="pb-3 pl-4 text-right tabular-nums">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-border/60">
                  <td className="py-3 pr-4 text-foreground-muted">
                    {formatDate(t.created_at)}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">
                    <Link
                      href={`/rentals/${t.id}`}
                      className="text-brand hover:underline"
                    >
                      {t.code}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{t.client_name}</td>
                  <td className="py-3 pr-4">
                    <PaidToggle rentalId={t.id} status={t.status} isAdmin={isAdmin} />
                  </td>
                  <td className="py-3 pr-4 capitalize">
                    {t.payment_method ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {t.consultation_fee != null ? formatGBP(t.consultation_fee) : "—"}
                  </td>
                  <td className="py-3 pl-4 text-right tabular-nums font-medium">
                    {formatGBP(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

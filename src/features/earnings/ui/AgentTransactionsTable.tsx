"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatGBP, formatDate } from "@/lib/utils/formatters";
import type { EarningsTransaction } from "../domain/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PaidToggle } from "./PaidToggle";
import { EarningsPayoutHover } from "./EarningsPayoutHover";

export function AgentTransactionsTable({
  transactions,
  from,
  to,
  minAmount,
  isAdmin = false,
  viewerAgentId,
}: {
  transactions: EarningsTransaction[];
  from: string;
  to: string;
  minAmount?: number;
  isAdmin?: boolean;
  /** The agent these transactions are filtered to. Used so the Paid toggle
   *  for marketing-role rows targets this agent's junction row. */
  viewerAgentId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtered = minAmount
    ? transactions.filter((t) => t.amount >= minAmount)
    : transactions;

  const totalConsultationFee = filtered.reduce(
    (sum, t) => sum + (t.consultation_fee ?? 0),
    0,
  );
  const totalEarnings = filtered.reduce((sum, t) => sum + t.amount, 0);
  const outstandingEarnings = filtered.reduce(
    (sum, t) => (t.status === "paid" ? sum : sum + t.amount),
    0,
  );

  const sumByMethod = (method: string) =>
    filtered.reduce(
      (sum, t) => (t.payment_method === method ? sum + (t.consultation_fee ?? 0) : sum),
      0,
    );
  const sumEarningsByMethod = (method: string) =>
    filtered.reduce(
      (sum, t) => (t.payment_method === method ? sum + t.amount : sum),
      0,
    );
  const totalCash = sumByMethod("cash");
  const totalCard = sumByMethod("card");
  const totalTransfer = sumByMethod("transfer");
  const commissionCash = sumEarningsByMethod("cash");
  const commissionCard = sumEarningsByMethod("card");
  const commissionTransfer = sumEarningsByMethod("transfer");

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
                <th className="pb-3 pr-4">Marketing agent</th>
                <th className="pb-3 pr-4">Role</th>
                <th className="pb-3 pr-4">Payment method</th>
                <th className="pb-3 pr-4 text-right tabular-nums">Consultation fee</th>
                <th className="pb-3 pr-4 text-right tabular-nums">Earnings</th>
                <th className="pb-3 pl-4">Paid</th>
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
                  <td className="py-3 pr-4 text-foreground-muted">
                    {t.marketing_agents && t.marketing_agents.length > 0
                      ? t.marketing_agents.join(", ")
                      : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    {t.role === "marketing" ? (
                      <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Marketing</span>
                    ) : t.role === "assisted" ? (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Assisted</span>
                    ) : (
                      <span className="text-foreground-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 capitalize">
                    {t.payment_method ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {t.consultation_fee != null ? formatGBP(t.consultation_fee) : "—"}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums font-medium">
                    <EarningsPayoutHover transaction={t}>
                      {formatGBP(t.amount)}
                    </EarningsPayoutHover>
                  </td>
                  <td className="py-3 pl-4">
                    <PaidToggle
                      rentalId={t.id}
                      status={t.status}
                      isAdmin={isAdmin}
                      role={t.role}
                      marketingAgentId={t.role === "marketing" ? viewerAgentId : undefined}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                <td className="pt-3 pr-4 text-foreground-muted" colSpan={6}>
                  Total agent revenue ({filtered.length} {filtered.length === 1 ? "rental" : "rentals"})
                </td>
                <td className="pt-3 pr-4 text-right tabular-nums">
                  {formatGBP(totalConsultationFee)}
                </td>
                <td className="pt-3 pr-4" />
                <td className="pt-3 pl-4" />
              </tr>
              <tr className="text-emerald-600">
                <td className="pr-4" colSpan={6}>
                  Total cash
                </td>
                <td className="pr-4 text-right tabular-nums">
                  {formatGBP(totalCash)}
                </td>
                <td className="pr-4 text-right tabular-nums">
                  {formatGBP(commissionCash)}
                </td>
                <td className="pl-4" />
              </tr>
              <tr className="text-blue-600">
                <td className="pr-4" colSpan={6}>
                  Total card + transfer
                </td>
                <td className="pr-4 text-right tabular-nums">
                  {formatGBP(totalCard + totalTransfer)}
                </td>
                <td className="pr-4 text-right tabular-nums">
                  {formatGBP(commissionCard + commissionTransfer)}
                </td>
                <td className="pl-4" />
              </tr>
              <tr className="font-semibold">
                <td className="pr-4 text-foreground-muted" colSpan={7}>
                  Total agent commission
                </td>
                <td className="pr-4 text-right tabular-nums">
                  {formatGBP(totalEarnings)}
                </td>
                <td className="pl-4" />
              </tr>
              <tr className="font-semibold">
                <td className="pb-3 pr-4 text-foreground-muted" colSpan={7}>
                  Outstanding (unpaid)
                </td>
                <td className="pb-3 pr-4 text-right tabular-nums text-amber-600">
                  {formatGBP(outstandingEarnings)}
                </td>
                <td className="pb-3 pl-4" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

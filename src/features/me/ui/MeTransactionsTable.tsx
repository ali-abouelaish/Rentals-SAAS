"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import { formatGBP, formatDate } from "@/lib/utils/formatters";
import type { EarningsTransaction } from "@/features/earnings/domain/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PaidToggle } from "@/features/earnings/ui/PaidToggle";
import { EarningsPayoutHover } from "@/features/earnings/ui/EarningsPayoutHover";

const PAGE_SIZE = 10;

export function MeTransactionsTable({
  transactions,
  isAdmin = false,
  viewerAgentId,
}: {
  transactions: EarningsTransaction[];
  isAdmin?: boolean;
  viewerAgentId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const sort = searchParams.get("sort") === "amount" ? "amount" : "date";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const [searchInput, setSearchInput] = useState(search);

  const filtered = useMemo(() => {
    let list = transactions;
    if (searchInput.trim()) {
      const q = searchInput.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.code.toLowerCase().includes(q) ||
          t.client_name.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sort === "amount") return b.amount - a.amount;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [transactions, searchInput, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totalConsultationFee = filtered.reduce((sum, t) => sum + (t.consultation_fee ?? 0), 0);
  const totalEarnings = filtered.reduce((sum, t) => sum + t.amount, 0);
  const outstandingEarnings = filtered.reduce(
    (sum, t) => (t.status === "paid" ? sum : sum + t.amount),
    0,
  );

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.set("page", "1");
    router.push(`/me?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-border">
        <form onSubmit={(e) => { e.preventDefault(); setParam("search", searchInput.trim()); }} className="flex gap-2">
          <Input placeholder="Search code or client..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="w-56 text-sm" />
          <Button type="submit" size="sm">Search</Button>
        </form>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-foreground-muted">Sort:</span>
          <button type="button" onClick={() => setParam("sort", "date")} className={sort === "date" ? "font-medium text-foreground" : "text-foreground-muted hover:text-foreground"}>Date</button>
          <span className="text-foreground-muted">|</span>
          <button type="button" onClick={() => setParam("sort", "amount")} className={sort === "amount" ? "font-medium text-foreground" : "text-foreground-muted hover:text-foreground"}>Amount</button>
        </div>
      </div>
      {paged.length === 0 ? (
        <p className="text-sm text-foreground-muted py-8 text-center">No transactions in this range.</p>
      ) : (
        <>
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
                {paged.map((t) => (
                  <tr key={t.id} className="border-b border-border/60">
                    <td className="py-3 pr-4 text-foreground-muted">{formatDate(t.created_at)}</td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      <Link href={`/rentals/${t.id}`} className="text-brand hover:underline">
                        {t.code}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">{t.client_name}</td>
                    <td className="py-3 pr-4 text-foreground-muted">
                      {t.marketing_agents && t.marketing_agents.length > 0 ? t.marketing_agents.join(", ") : "—"}
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
                    <td className="py-3 pr-4 capitalize">{t.payment_method ?? "—"}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{t.consultation_fee != null ? formatGBP(t.consultation_fee) : "—"}</td>
                    <td className="py-3 pr-4 text-right tabular-nums font-medium">
                      <EarningsPayoutHover transaction={t}>{formatGBP(t.amount)}</EarningsPayoutHover>
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
                  <td className="pt-3 pr-4 text-right tabular-nums">{formatGBP(totalConsultationFee)}</td>
                  <td className="pt-3 pr-4" />
                  <td className="pt-3 pl-4" />
                </tr>
                <tr className="font-semibold">
                  <td className="pr-4 text-foreground-muted" colSpan={7}>
                    Total agent commission
                  </td>
                  <td className="pr-4 text-right tabular-nums">{formatGBP(totalEarnings)}</td>
                  <td className="pl-4" />
                </tr>
                <tr className="font-semibold">
                  <td className="pb-3 pr-4 text-foreground-muted" colSpan={7}>
                    Outstanding (unpaid)
                  </td>
                  <td className="pb-3 pr-4 text-right tabular-nums text-amber-600">{formatGBP(outstandingEarnings)}</td>
                  <td className="pb-3 pl-4" />
                </tr>
              </tfoot>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-foreground-muted">Page {currentPage} of {totalPages} · {filtered.length} rows</p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setParam("page", String(currentPage - 1))}>Previous</Button>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setParam("page", String(currentPage + 1))}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

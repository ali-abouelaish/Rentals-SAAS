"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import { formatGBP, formatDate } from "@/lib/utils/formatters";
import type { EarningsTransaction } from "@/features/earnings/domain/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 10;

export function MeTransactionsTable({ transactions }: { transactions: EarningsTransaction[] }) {
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
          t.property_name.toLowerCase().includes(q) ||
          (t.tenant_name ?? "").toLowerCase().includes(q)
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
          <Input placeholder="Search property or tenant..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="w-56 text-sm" />
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
                  <th className="pb-3 pr-4">Property</th>
                  <th className="pb-3 pr-4">Tenant</th>
                  <th className="pb-3 pr-4 text-right tabular-nums">Rent</th>
                  <th className="pb-3 pl-4 text-right tabular-nums">Earnings</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((t) => (
                  <tr key={t.id} className="border-b border-border/60">
                    <td className="py-3 pr-4 text-foreground-muted">{formatDate(t.created_at)}</td>
                    <td className="py-3 pr-4">{t.property_name}</td>
                    <td className="py-3 pr-4 text-foreground-muted">{t.tenant_name ?? "—"}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{t.rent_amount != null ? formatGBP(t.rent_amount) : "—"}</td>
                    <td className="py-3 pl-4 text-right tabular-nums font-medium">{formatGBP(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
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

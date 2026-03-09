"use client";

import { useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatGBP } from "@/lib/utils/formatters";
import type { EarningsTrendPoint } from "@/features/earnings/domain/types";
import type { EarningsTransaction } from "@/features/earnings/domain/types";

function groupRentalsByDate(
  transactions: EarningsTransaction[],
  bucket: "day" | "week"
): Array<{ date: string; count: number }> {
  const map = new Map<string, number>();
  transactions.forEach((t) => {
    const d = new Date(t.created_at);
    const key =
      bucket === "week"
        ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - d.getUTCDay())).toISOString().slice(0, 10)
        : t.created_at.slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

type MeTrendChartProps = {
  trend: EarningsTrendPoint[];
  transactions: EarningsTransaction[];
};

export function MeTrendChart({ trend, transactions }: MeTrendChartProps) {
  const [mode, setMode] = useState<"earnings" | "rentals">("earnings");
  const rentalsData = groupRentalsByDate(transactions, trend.length > 45 ? "week" : "day");

  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h3 className="text-base font-semibold text-foreground">Over time</h3>
        <div className="flex rounded-lg border border-border bg-surface-inset p-0.5">
          <button
            type="button"
            onClick={() => setMode("earnings")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${mode === "earnings" ? "bg-background text-foreground shadow-sm" : "text-foreground-muted hover:text-foreground"}`}
          >
            Earnings
          </button>
          <button
            type="button"
            onClick={() => setMode("rentals")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${mode === "rentals" ? "bg-background text-foreground shadow-sm" : "text-foreground-muted hover:text-foreground"}`}
          >
            Rentals
          </button>
        </div>
      </div>
      <div className="h-64 w-full">
        {mode === "earnings" && trend.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <XAxis dataKey="bucket_date" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `£${v}`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [formatGBP(Number(v)), "Earnings"]} />
              <Area type="monotone" dataKey="agent_earnings" stroke="#0d9488" fill="#0d9488" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
        {mode === "rentals" && rentalsData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rentalsData}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [v, "Rentals"]} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Rentals" />
            </BarChart>
          </ResponsiveContainer>
        )}
        {((mode === "earnings" && trend.length === 0) || (mode === "rentals" && rentalsData.length === 0)) && (
          <p className="text-sm text-foreground-muted flex items-center justify-center h-full">No data in this period</p>
        )}
      </div>
    </div>
  );
}

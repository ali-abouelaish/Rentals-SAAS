"use client";

import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatGBP } from "@/lib/utils/formatters";
import type { EarningsTrendPoint, EarningsTransaction } from "../domain/types";

function groupByDate(
  transactions: EarningsTransaction[],
  bucket: "day" | "week"
): Array<{ bucket_date: string; count: number }> {
  const map = new Map<string, number>();
  transactions.forEach((t) => {
    const d = new Date(t.created_at);
    const key =
      bucket === "week"
        ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - d.getUTCDay()))
            .toISOString()
            .slice(0, 10)
        : t.created_at.slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([bucket_date, count]) => ({ bucket_date, count }))
    .sort((a, b) => a.bucket_date.localeCompare(b.bucket_date));
}

export function AgentProfileCharts({
  trend,
  transactions
}: {
  trend: EarningsTrendPoint[];
  transactions: EarningsTransaction[];
}) {
  const rentalsOverTime = groupByDate(transactions, trend.length > 45 ? "week" : "day");

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-bento bg-surface-card shadow-bento p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">Earnings over time</h3>
        <div className="h-64 w-full">
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <XAxis dataKey="bucket_date" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `£${v}`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [formatGBP(Number(v)), "Earnings"]} />
                <Area type="monotone" dataKey="agent_earnings" stroke="#0d9488" fill="#0d9488" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-foreground-muted flex items-center justify-center h-full">No earnings in this period</p>
          )}
        </div>
      </div>
      <div className="rounded-bento bg-surface-card shadow-bento p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">Rentals over time</h3>
        <div className="h-64 w-full">
          {rentalsOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rentalsOverTime}>
                <XAxis dataKey="bucket_date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, "Rentals"]} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Rentals" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-foreground-muted flex items-center justify-center h-full">No rentals in this period</p>
          )}
        </div>
      </div>
    </div>
  );
}

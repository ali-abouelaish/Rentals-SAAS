"use client";

import { useState } from "react";
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import { BarChart2, TrendingUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatGBP } from "@/lib/utils/formatters";
import type { EarningsTrendPoint, EarningsTransaction } from "@/features/earnings/domain/types";

type BonusLike = {
  bonus_date: string;
  amount_owed: number;
  payout_mode?: string | null;
  created_at: string;
};

function groupRentalsByDate(
  transactions: EarningsTransaction[],
  bucket: "day" | "week"
): Array<{ date: string; count: number }> {
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
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function mergeBonusesIntoTrend(
  trend: EarningsTrendPoint[],
  bonuses: BonusLike[],
  commissionPercent: number
): EarningsTrendPoint[] {
  const bonusByDate = new Map<string, number>();
  bonuses.forEach((b) => {
    const date = (b.bonus_date ?? b.created_at).slice(0, 10);
    const share = b.payout_mode === "full" ? b.amount_owed : b.amount_owed * (commissionPercent / 100);
    bonusByDate.set(date, (bonusByDate.get(date) ?? 0) + share);
  });

  // Clone trend and add bonus amounts
  const merged = trend.map((p) => ({
    ...p,
    agent_earnings: p.agent_earnings + (bonusByDate.get(p.bucket_date) ?? 0),
  }));

  // Add bonus-only dates not present in rental trend
  const trendDates = new Set(trend.map((p) => p.bucket_date));
  bonusByDate.forEach((amount, date) => {
    if (!trendDates.has(date)) {
      merged.push({ bucket_date: date, total_earnings: 0, agent_earnings: amount });
    }
  });

  merged.sort((a, b) => a.bucket_date.localeCompare(b.bucket_date));
  return merged;
}

function EmptyChart({ mode }: { mode: "earnings" | "rentals" }) {
  return (
    <div className="h-64 flex flex-col items-center justify-center gap-3">
      {/* Skeleton sparkline */}
      <div className="flex items-end gap-1 opacity-20 mb-1">
        {[18, 28, 22, 36, 24, 44, 30, 38, 26, 42, 32, 48].map((h, i) => (
          <div
            key={i}
            className="w-4 rounded-sm bg-brand animate-pulse"
            style={{ height: h, animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground mb-1">No {mode} data yet</p>
        <p className="text-xs text-foreground-muted mb-3">
          {mode === "earnings"
            ? "Complete your first rental to start tracking earnings over time."
            : "Your rental activity will appear here once you start logging rentals."}
        </p>
        <Link
          href="/rentals"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
        >
          <Plus className="h-3 w-3" />
          {mode === "earnings" ? "Start tracking earnings" : "Add first rental"}
        </Link>
      </div>
    </div>
  );
}

type MeTrendChartProps = {
  trend: EarningsTrendPoint[];
  transactions: EarningsTransaction[];
  bonuses?: BonusLike[];
  commissionPercent?: number;
};

type DataMode = "earnings" | "rentals";
type ChartType = "area" | "bar" | "line";

export function MeTrendChart({ trend, transactions, bonuses, commissionPercent }: MeTrendChartProps) {
  const [mode, setMode] = useState<DataMode>("earnings");
  const [chartType, setChartType] = useState<ChartType>("area");

  const trendWithBonuses = bonuses && bonuses.length > 0
    ? mergeBonusesIntoTrend(trend, bonuses, commissionPercent ?? 50)
    : trend;
  const rentalsData = groupRentalsByDate(transactions, trend.length > 45 ? "week" : "day");
  const hasData = mode === "earnings" ? trendWithBonuses.length > 0 : rentalsData.length > 0;

  const tooltipStyle = {
    backgroundColor: "var(--surface-elevated, #fff)",
    border: "1px solid var(--border, #e5e7eb)",
    borderRadius: 10,
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    fontSize: 12,
  };

  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-semibold text-foreground">Over time</h3>
          <p className="text-xs text-foreground-muted mt-0.5">
            {mode === "earnings" ? "Your earnings trend" : "Rental activity"} for the selected period
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Data mode toggle */}
          <div className="flex rounded-lg border border-border bg-surface-inset p-0.5">
            {(["earnings", "rentals"] as DataMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all",
                  mode === m
                    ? "bg-surface-card text-foreground shadow-xs"
                    : "text-foreground-muted hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Chart type toggle — only when there's data */}
          {hasData && (
            <div className="flex rounded-lg border border-border bg-surface-inset p-0.5">
              {([
                { value: "area",  icon: TrendingUp },
                { value: "bar",   icon: BarChart2 },
                { value: "line",  icon: TrendingUp },
              ] as { value: ChartType; icon: React.ElementType }[]).map(({ value, icon: Ico }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setChartType(value)}
                  title={value.charAt(0).toUpperCase() + value.slice(1) + " chart"}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md transition-all",
                    chartType === value
                      ? "bg-surface-card text-foreground shadow-xs"
                      : "text-foreground-muted hover:text-foreground"
                  )}
                >
                  <Ico className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chart area */}
      {!hasData ? (
        <EmptyChart mode={mode} />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {mode === "earnings" ? (
              chartType === "bar" ? (
                <BarChart data={trendWithBonuses} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <XAxis dataKey="bucket_date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => `£${v}`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip formatter={(v) => [formatGBP(Number(v)), "Earnings"]} contentStyle={tooltipStyle} />
                  <Bar dataKey="agent_earnings" fill="var(--brand, #0d9488)" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : chartType === "line" ? (
                <LineChart data={trendWithBonuses} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <XAxis dataKey="bucket_date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => `£${v}`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip formatter={(v) => [formatGBP(Number(v)), "Earnings"]} contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="agent_earnings" stroke="var(--brand, #0d9488)" strokeWidth={2} dot={false} />
                </LineChart>
              ) : (
                <AreaChart data={trendWithBonuses} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--brand, #0d9488)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--brand, #0d9488)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="bucket_date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => `£${v}`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip formatter={(v) => [formatGBP(Number(v)), "Earnings"]} contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="agent_earnings" stroke="var(--brand, #0d9488)" strokeWidth={2} fill="url(#earningsGrad)" />
                </AreaChart>
              )
            ) : chartType === "line" ? (
              <LineChart data={rentalsData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip formatter={(v) => [v, "Rentals"]} contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            ) : chartType === "area" ? (
              <AreaChart data={rentalsData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="rentalsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip formatter={(v) => [v, "Rentals"]} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#rentalsGrad)" />
              </AreaChart>
            ) : (
              <BarChart data={rentalsData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip formatter={(v) => [v, "Rentals"]} contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

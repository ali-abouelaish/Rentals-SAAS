"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { PortfolioMonthPoint } from "../domain/types";

interface PortfolioGraphProps {
  data: PortfolioMonthPoint[];
  portfolios: Array<{ name: string; color: string }>;
}

const PERIODS = [
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "12 months", months: 12 },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface-card p-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-foreground-secondary">{entry.name}:</span>
          <span
            className={`font-semibold tabular-nums ${
              entry.value < 0 ? "text-red-600" : "text-emerald-600"
            }`}
          >
            {entry.value < 0 ? "-" : ""}£{Math.abs(entry.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Recharts sizes itself to its container but knows nothing about legibility:
 * twelve month labels and a full £ y-axis are unreadable at 360px. This drives
 * the handful of props that need to thin out on a phone.
 */
function useIsNarrow(breakpoint = 640) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return narrow;
}

export function PortfolioGraph({ data, portfolios }: PortfolioGraphProps) {
  const isNarrow = useIsNarrow();
  const [period, setPeriod] = useState(12);
  const [view, setView] = useState<"actual" | "projected" | "both">("actual");

  const sliced = data.slice(-period);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Period selector */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {PERIODS.map(({ label, months }) => (
            <button
              key={months}
              onClick={() => setPeriod(months)}
              className={`px-3 py-1.5 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 text-xs font-medium transition-colors ${
                period === months
                  ? "bg-brand text-brand-fg"
                  : "text-foreground-secondary hover:bg-surface-inset"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["actual", "projected", "both"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 text-xs font-medium capitalize transition-colors ${
                view === v
                  ? "bg-brand text-brand-fg"
                  : "text-foreground-secondary hover:bg-surface-inset"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={isNarrow ? 220 : 300}>
        <LineChart data={sliced} margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" vertical={false} />
          <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" strokeWidth={1} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: isNarrow ? 10 : 11, fill: "var(--foreground-muted, #9ca3af)" }}
            axisLine={false}
            tickLine={false}
            interval={isNarrow ? "preserveStartEnd" : 0}
            minTickGap={isNarrow ? 24 : 5}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--foreground-muted, #9ca3af)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              isNarrow
                ? `£${v < 0 ? "-" : ""}${Math.abs(v) >= 1000 ? `${Math.round(Math.abs(v) / 1000)}k` : Math.abs(v)}`
                : `£${v < 0 ? "-" : ""}${Math.abs(v).toLocaleString()}`
            }
            width={isNarrow ? 44 : 72}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
            iconType="circle"
            iconSize={8}
          />
          {portfolios.map((p) => (
            <Line
              key={p.name}
              type="monotone"
              dataKey={p.name}
              stroke={p.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
              strokeDasharray={view === "projected" ? "5 5" : undefined}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {view !== "actual" && (
        <p className="text-[11px] text-foreground-muted text-center">
          Projected view uses contracted rents and recurring costs only — one-off costs excluded.
        </p>
      )}
    </div>
  );
}

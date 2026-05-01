"use client";

import { useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { LineChart as LineIcon, BarChart3 } from "lucide-react";
import type { PropertyMonthPoint } from "../domain/types";

interface PropertyTrendChartProps {
  data: PropertyMonthPoint[];
}

const PERIODS = [
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
              entry.value < 0 ? "text-red-600" : "text-foreground"
            }`}
          >
            {entry.value < 0 ? "-" : ""}£{Math.abs(entry.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PropertyTrendChart({ data }: PropertyTrendChartProps) {
  const [period, setPeriod] = useState<6 | 12>(12);
  const [mode, setMode] = useState<"line" | "bar">("line");

  const sliced = data.slice(-period);

  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Net Profit Over Time</h2>
          <p className="text-xs text-foreground-muted mt-0.5">
            Income, costs, and net profit per month (vacancy loss not included historically)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setMode("line")}
              className={`px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                mode === "line"
                  ? "bg-brand text-brand-fg"
                  : "text-foreground-secondary hover:bg-surface-inset"
              }`}
            >
              <LineIcon size={13} />
              Line
            </button>
            <button
              onClick={() => setMode("bar")}
              className={`px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                mode === "bar"
                  ? "bg-brand text-brand-fg"
                  : "text-foreground-secondary hover:bg-surface-inset"
              }`}
            >
              <BarChart3 size={13} />
              Bar
            </button>
          </div>
          {/* Period selector */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {PERIODS.map(({ label, months }) => (
              <button
                key={months}
                onClick={() => setPeriod(months)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === months
                    ? "bg-brand text-brand-fg"
                    : "text-foreground-secondary hover:bg-surface-inset"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={sliced} margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" vertical={false} />
          <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" strokeWidth={1} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "var(--foreground-muted, #9ca3af)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--foreground-muted, #9ca3af)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              `£${v < 0 ? "-" : ""}${Math.abs(v).toLocaleString()}`
            }
            width={72}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
            iconType="circle"
            iconSize={8}
          />
          {mode === "bar" ? (
            <>
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="costs" name="Costs" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="net_profit"
                name="Net Profit"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </>
          ) : (
            <>
              <Line
                type="monotone"
                dataKey="income"
                name="Income"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="costs"
                name="Costs"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="net_profit"
                name="Net Profit"
                stroke="#0ea5e9"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

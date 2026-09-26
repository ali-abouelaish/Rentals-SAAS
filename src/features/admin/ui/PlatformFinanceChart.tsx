"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FinanceMonth } from "../data/finance";

/**
 * Revenue against costs, month by month.
 *
 * Bars for the two quantities being compared and a line for the result: revenue
 * and expenses are magnitudes you weigh against each other, while net is a
 * trend, and giving it a different mark stops it reading as a third competing
 * bar. Follows the chart conventions already used in PortfolioGraph —
 * CSS-variable colours, no axis lines, a card tooltip.
 */

// Pounds, not pence, for the axis and tooltip. Everything upstream is integer
// pence; the division happens once, here, at the display boundary.
const toPounds = (pence: number) => pence / 100;

const COLORS = {
  invoiced: "#059669",
  expenses: "#d97706",
  net: "#4f46e5",
};

function money(pounds: number): string {
  const rounded = Math.round(Math.abs(pounds));
  return `${pounds < 0 ? "−" : ""}£${rounded.toLocaleString()}`;
}

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
              entry.name === "Net" && entry.value < 0
                ? "text-red-600"
                : "text-foreground"
            }`}
          >
            {money(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PlatformFinanceChart({ series }: { series: FinanceMonth[] }) {
  const data = series.map((month) => ({
    month: month.shortLabel,
    Invoiced: toPounds(month.invoicedPence),
    Expenses: toPounds(month.expensesPence),
    Net: toPounds(month.netPence),
  }));

  const hasAnything = series.some(
    (m) => m.invoicedPence > 0 || m.expensesPence > 0
  );

  if (!hasAnything) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center">
        <p className="text-sm text-foreground-secondary">
          Nothing to plot yet. Add an expense below, or issue an invoice, and the
          months will start filling in.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border, #e5e7eb)"
          vertical={false}
        />
        {/* Zero line, because net genuinely can be negative and a loss should
            read as crossing a line rather than as a short bar. */}
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
          tickFormatter={(v: number) => money(v)}
          width={72}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--surface-inset, #f3f4f6)" }} />
        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} iconType="circle" iconSize={8} />
        <Bar dataKey="Invoiced" fill={COLORS.invoiced} radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Bar dataKey="Expenses" fill={COLORS.expenses} radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Line
          type="monotone"
          dataKey="Net"
          stroke={COLORS.net}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

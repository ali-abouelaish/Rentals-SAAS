"use client";

import { cn } from "@/lib/utils/cn";

interface BreakEvenTimelineProps {
  totalSetupCost: number; // pence
  monthlyNetProfit: number; // pence
  breakEvenMonths: number;
  breakEvenDate: string | null;
  annualRoi: number;
  createdAt: string;
}

const fmt = (pence: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pence / 100);

export function BreakEvenTimeline({
  totalSetupCost,
  monthlyNetProfit,
  breakEvenMonths,
  breakEvenDate,
  annualRoi,
  createdAt,
}: BreakEvenTimelineProps) {
  const profitable = monthlyNetProfit > 0 && breakEvenMonths > 0;
  const displayMonths = Math.min(breakEvenMonths, 36);

  // Build monthly cumulative recovery bars (cap at 30 segments for display)
  const segmentCount = Math.min(displayMonths, 30);
  const segments = Array.from({ length: segmentCount }, (_, i) => {
    const recovered = monthlyNetProfit * (i + 1);
    const pct = Math.min((recovered / totalSetupCost) * 100, 100);
    return { month: i + 1, recovered, pct };
  });

  const beDate = breakEvenDate
    ? new Date(breakEvenDate).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      })
    : null;

  const startDate = new Date(createdAt).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });

  if (!profitable) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-5 text-center">
        <p className="text-sm text-foreground-secondary">
          Break-even timeline unavailable — property is not profitable at current figures.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Key numbers */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-surface-raised p-4 text-center">
          <p className="text-[11px] text-foreground-secondary mb-1">Monthly Net Profit</p>
          <p className="text-lg font-bold text-green-400">{fmt(monthlyNetProfit)}</p>
        </div>
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-center">
          <p className="text-[11px] text-foreground-secondary mb-1">Break-Even</p>
          <p className="text-lg font-bold text-brand">{breakEvenMonths} months</p>
          {beDate && <p className="text-[11px] text-foreground-secondary mt-0.5">{beDate}</p>}
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-4 text-center">
          <p className="text-[11px] text-foreground-secondary mb-1">Annual ROI</p>
          <p
            className={cn(
              "text-lg font-bold",
              annualRoi >= 15
                ? "text-green-400"
                : annualRoi >= 8
                ? "text-amber-400"
                : "text-foreground"
            )}
          >
            {annualRoi.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Progress bar timeline */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-[12px] text-foreground-secondary">
          <span>Setup invested: {fmt(totalSetupCost)}</span>
          <span>Break-even: {beDate}</span>
        </div>

        {/* Bar track */}
        <div className="relative h-8 rounded-full bg-surface-raised border border-border overflow-hidden">
          {profitable && (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand/60 to-brand transition-all duration-700"
              style={{
                width: `${Math.min(
                  (Math.min(breakEvenMonths, displayMonths) / displayMonths) * 100,
                  100
                )}%`,
              }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-semibold text-foreground mix-blend-overlay">
              {breakEvenMonths} months to recover {fmt(totalSetupCost)}
            </span>
          </div>
        </div>

        {/* Month segments */}
        <div className="relative">
          <div className="flex gap-0.5">
            {segments.map((seg) => (
              <div
                key={seg.month}
                title={`Month ${seg.month}: £${(seg.recovered / 100).toFixed(0)} recovered`}
                className={cn(
                  "flex-1 rounded-sm transition-colors",
                  seg.pct >= 100
                    ? "bg-green-400"
                    : seg.pct >= 50
                    ? "bg-brand/60"
                    : "bg-brand/30"
                )}
                style={{ height: 20 }}
              />
            ))}
            {breakEvenMonths > displayMonths && (
              <div className="flex-none ml-1 self-center text-[10px] text-foreground-secondary">
                +{breakEvenMonths - displayMonths}mo
              </div>
            )}
          </div>

          {/* Label at break-even point */}
          {breakEvenMonths <= displayMonths && (
            <div
              className="absolute top-full mt-1 text-[10px] font-semibold text-green-400 -translate-x-1/2"
              style={{
                left: `${Math.min((breakEvenMonths / displayMonths) * 100, 96)}%`,
              }}
            >
              ✓ Recovered
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-foreground-secondary mt-6">
          <span>{startDate}</span>
          {beDate && <span className="text-green-400 font-medium">{beDate}</span>}
        </div>
      </div>

      {/* Annual projection table */}
      <div className="rounded-xl border border-border bg-surface-raised overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-card">
          <span className="text-[13px] font-semibold text-foreground">Cumulative Recovery Projection</span>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left font-medium text-foreground-secondary">Period</th>
              <th className="px-4 py-2 text-right font-medium text-foreground-secondary">Recovered</th>
              <th className="px-4 py-2 text-right font-medium text-foreground-secondary">Remaining</th>
              <th className="px-4 py-2 text-right font-medium text-foreground-secondary">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[3, 6, 12, 18, 24].map((m) => {
              const recovered = monthlyNetProfit * m;
              const remaining = Math.max(totalSetupCost - recovered, 0);
              const done = recovered >= totalSetupCost;
              return (
                <tr key={m} className={cn("transition-colors", done && "bg-green-500/5")}>
                  <td className="px-4 py-2.5 text-foreground">Month {m}</td>
                  <td className="px-4 py-2.5 text-right text-foreground">
                    {fmt(Math.min(recovered, totalSetupCost))}
                  </td>
                  <td className="px-4 py-2.5 text-right text-foreground-secondary">
                    {done ? "—" : fmt(remaining)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {done ? (
                      <span className="text-green-400 font-medium">Recovered ✓</span>
                    ) : (
                      <span className="text-foreground-secondary">
                        {Math.round((recovered / totalSetupCost) * 100)}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

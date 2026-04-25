"use client";

import type { HistoryStats } from "../domain/history";

function formatTenancyLength(days: number): string {
  if (days <= 0) return "—";
  if (days < 365) {
    const months = Math.round(days / 30.44);
    return `${months}mo`;
  }
  const years = (days / 365).toFixed(1);
  return `${years}y`;
}

export function HistoryStatsStrip({
  stats,
  currentVoidDays,
}: {
  stats: HistoryStats;
  currentVoidDays?: number | null;
}) {
  const tiles: Array<{ label: string; value: string }> = [
    { label: "Occupancy (12 mo)", value: `${stats.occupancyPct.toFixed(1)}%` },
    { label: "Avg tenancy", value: formatTenancyLength(stats.averageTenancyDays) },
    { label: "Total tenants", value: String(stats.totalTenancies) },
  ];
  if (currentVoidDays != null && currentVoidDays > 0) {
    tiles.push({
      label: "Currently vacant",
      value: `${currentVoidDays}d`,
    });
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-xl border border-border bg-surface-inset px-3 py-2.5"
        >
          <p className="text-lg font-bold text-foreground tabular-nums">{t.value}</p>
          <p className="text-[10px] uppercase tracking-wider text-foreground-muted mt-0.5">
            {t.label}
          </p>
        </div>
      ))}
    </div>
  );
}

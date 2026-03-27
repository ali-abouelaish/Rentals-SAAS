import { TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type TrendInfo = {
  direction: "up" | "down" | "neutral";
  percent: number;
  label?: string;
};

type StatCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  accentColor?: string;   // left-border / top-stripe color class e.g. "bg-emerald-500"
  trend?: TrendInfo;
  sublabel?: string;
};

export function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-emerald-600",
  iconBg = "bg-emerald-50",
  accentColor = "bg-emerald-500",
  trend,
  sublabel,
}: StatCardProps) {
  const trendPositive = trend?.direction === "up";

  return (
    <div className="relative rounded-bento bg-surface-card shadow-bento overflow-hidden hover:shadow-bento-hover transition-all duration-base group">
      {/* Left accent bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-bento", accentColor)} />

      <div className="p-5 pl-6">
        {/* Icon + trend row */}
        <div className="flex items-start justify-between mb-3">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", iconBg)}>
            <Icon className={cn("h-4.5 w-4.5", iconColor)} strokeWidth={1.8} />
          </div>
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                trendPositive
                  ? "bg-emerald-50 text-emerald-700"
                  : trend.direction === "down"
                  ? "bg-red-50 text-red-600"
                  : "bg-surface-inset text-foreground-muted"
              )}
            >
              {trendPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : trend.direction === "down" ? (
                <TrendingDown className="h-3 w-3" />
              ) : null}
              {trend.direction !== "neutral" && `${trend.percent > 0 ? "+" : ""}${trend.percent.toFixed(1)}%`}
              {trend.direction === "neutral" && "—"}
            </span>
          )}
        </div>

        {/* Value */}
        <p className="text-[28px] font-bold text-foreground tabular-nums leading-none mb-1.5">
          {value}
        </p>

        {/* Label */}
        <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted leading-none">
          {label}
        </p>

        {/* Sublabel */}
        {sublabel && (
          <p className="text-[11px] text-foreground-muted mt-1">{sublabel}</p>
        )}

        {/* Trend label */}
        {trend?.label && (
          <p className="text-[11px] text-foreground-muted mt-0.5">{trend.label}</p>
        )}
      </div>
    </div>
  );
}

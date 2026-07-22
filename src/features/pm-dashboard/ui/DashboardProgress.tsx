"use client";

import Link from "next/link";
import { ListTodo, Wrench, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PmTodo } from "../domain/todos";
import type { MaintenanceSummary } from "@/features/profitability/domain/types";

// ──────────────────────────────────────────────────────────
// Segmented completion donut (Alto-style): a thick ring split into
// status segments, a legend list beside it, and the total in the centre.
// Each segment is directly labelled in the legend, so identity never
// rests on colour alone.
// ──────────────────────────────────────────────────────────

type Segment = { key: string; label: string; value: number; color: string };

function SegmentedDonut({
  segments,
  size = 150,
  stroke = 22,
  centerLabel,
}: {
  segments: Segment[];
  size?: number;
  stroke?: number;
  centerLabel: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  const gap = 3; // px surface gap between adjacent segments

  const active = segments.filter((s) => s.value > 0);
  const single = active.length === 1;

  let acc = 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-inset)" strokeWidth={stroke} />

        {total > 0 &&
          (single ? (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={active[0].color}
              strokeWidth={stroke}
            />
          ) : (
            segments.map((seg) => {
              if (seg.value <= 0) return null;
              const len = (seg.value / total) * circ;
              const dash = Math.max(0, len - gap);
              const rotation = -90 + (acc / total) * 360;
              acc += seg.value;
              return (
                <circle
                  key={seg.key}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ - dash}`}
                  transform={`rotate(${rotation} ${cx} ${cy})`}
                  style={{ transition: "stroke-dasharray 500ms ease" }}
                />
              );
            })
          ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums text-foreground leading-none">{total}</span>
        <span className="text-[11px] font-medium text-foreground-muted mt-1">{centerLabel}</span>
      </div>
    </div>
  );
}

function Legend({ segments, total }: { segments: Segment[]; total: number }) {
  return (
    <ul className="flex-1 min-w-0 space-y-2.5">
      {segments.map((seg) => {
        const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
        return (
          <li key={seg.key} className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-sm text-foreground-secondary truncate">{seg.label}</span>
            <span className="ml-auto flex items-baseline gap-1.5 shrink-0">
              <span className="text-sm font-semibold tabular-nums text-foreground">{seg.value}</span>
              <span className="text-[11px] tabular-nums text-foreground-muted w-8 text-right">{pct}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function DonutCard({
  icon: Icon,
  iconWrap,
  iconColor,
  title,
  badge,
  segments,
  centerLabel,
  href,
  footer,
}: {
  icon: typeof ListTodo;
  iconWrap: string;
  iconColor: string;
  title: string;
  badge?: string;
  segments: Segment[];
  centerLabel: string;
  href?: string;
  footer?: React.ReactNode;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className={cn("p-2 rounded-lg", iconWrap)}>
            <Icon className={cn("h-4 w-4", iconColor)} strokeWidth={2} />
          </div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {badge && (
            <span className="text-xs font-medium text-foreground-secondary bg-surface-inset px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="text-[13px] font-medium text-foreground-muted hover:text-brand transition-colors flex items-center gap-1"
          >
            View <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {total === 0 ? (
        <div className="flex items-center gap-6">
          <SegmentedDonut segments={segments} centerLabel={centerLabel} />
          <p className="text-sm text-foreground-muted">Nothing to track yet.</p>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          <SegmentedDonut segments={segments} centerLabel={centerLabel} />
          <Legend segments={segments} total={total} />
        </div>
      )}
      {footer && <div className="mt-4 pt-4 border-t border-border">{footer}</div>}
    </div>
  );
}

export function TodoProgressCard({ todos }: { todos: PmTodo[] }) {
  const todosDone = todos.filter((t) => t.is_done).length;
  const todosOpen = todos.length - todosDone;

  const segments: Segment[] = [
    { key: "done", label: "Completed", value: todosDone, color: "#10b981" }, // emerald-500
    { key: "open", label: "Open", value: todosOpen, color: "#f59e0b" }, // amber-500
  ];

  return (
    <DonutCard
      icon={ListTodo}
      iconWrap="bg-brand-subtle"
      iconColor="text-brand"
      title="To-do progress"
      badge={todosOpen > 0 ? `${todosOpen} open` : undefined}
      segments={segments}
      centerLabel="Tasks"
    />
  );
}

export function MaintenanceProgressCard({ maintenance }: { maintenance: MaintenanceSummary }) {
  const segments: Segment[] = [
    { key: "resolved", label: "Resolved this month", value: maintenance.resolved_this_month, color: "#10b981" }, // emerald-500
    { key: "in_progress", label: "In progress", value: maintenance.in_progress_jobs, color: "#3b82f6" }, // blue-500
    { key: "open", label: "Open", value: maintenance.open_jobs, color: "#f97316" }, // orange-500
  ];

  const costThisMonth =
    maintenance.total_cost_this_month > 0
      ? `£${Math.round(maintenance.total_cost_this_month / 100).toLocaleString()}`
      : "£0";

  return (
    <DonutCard
      icon={Wrench}
      iconWrap="bg-orange-50"
      iconColor="text-orange-600"
      title="Maintenance"
      badge={maintenance.critical_jobs > 0 ? `${maintenance.critical_jobs} critical` : undefined}
      segments={segments}
      centerLabel="Jobs"
      href="/maintenance"
      footer={
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground-secondary">Cost this month</span>
          <span className="text-sm font-semibold tabular-nums text-foreground">{costThisMonth}</span>
        </div>
      }
    />
  );
}

"use client";

/**
 * Mobile-only PM home (`md:hidden`) — big tappable section tiles with live
 * counts + a compact "needs attention" card. Reuses the same DashboardData the
 * desktop dashboard already fetches (no extra queries) and the same design
 * tokens (white bento cards, soft shadow, pastel icon squares).
 */
import Link from "next/link";
import {
  Wrench,
  Banknote,
  Building2,
  Users2,
  FileSignature,
  CalendarCheck,
  AlertTriangle,
  ShieldCheck,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import type { DashboardData, DashboardActionSeverity } from "@/features/profitability/domain/types";

const SEVERITY_DOT: Record<DashboardActionSeverity, string> = {
  critical: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-slate-400",
};
const SEVERITY_ROW: Record<DashboardActionSeverity, string> = {
  critical: "bg-red-50",
  high: "bg-amber-50",
  medium: "bg-surface-inset",
};

type Tile = {
  href: string;
  icon: LucideIcon;
  tint: string;
  /** Primary line — a stat value (styled big) or the section name. */
  title: string;
  titleIsValue?: boolean;
  sub: string;
  badge?: { text: string; tone: "amber" | "red" } | null;
};

export function MobileDashboardHome({
  data,
  userName,
  topSlot,
}: {
  data: DashboardData;
  userName: string;
  // Rendered directly under the greeting, above the tiles.
  topSlot?: React.ReactNode;
}) {
  const now = new Date();
  const today = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  const occupancyPct =
    data.total_units > 0 ? Math.round((data.occupied_units / data.total_units) * 100) : 0;
  const m = data.maintenance_summary;
  const c = data.collection;
  const moveOuts = data.upcoming_move_outs.length;

  const tiles: Tile[] = [
    {
      href: "/maintenance",
      icon: Wrench,
      tint: "bg-blue-50 text-blue-600",
      title: "Maintenance",
      sub: `${m.in_progress_jobs} in progress`,
      badge: m.open_jobs > 0 ? { text: `${m.open_jobs} open`, tone: "amber" } : null,
    },
    {
      href: "/rent-collection",
      icon: Banknote,
      tint: "bg-emerald-50 text-emerald-600",
      title: c ? `${c.collected_pct}%` : "Rent",
      titleIsValue: Boolean(c),
      sub: c ? "Rent collected" : "This month",
      badge: c && c.tenants_behind > 0 ? { text: `${c.tenants_behind} behind`, tone: "red" } : null,
    },
    {
      href: "/properties",
      icon: Building2,
      tint: "bg-violet-50 text-violet-600",
      title: `${occupancyPct}%`,
      titleIsValue: true,
      sub: "Occupancy · Properties",
    },
    {
      href: "/tenants",
      icon: Users2,
      tint: "bg-amber-50 text-amber-600",
      title: String(c?.total_tenancies ?? data.occupied_units),
      titleIsValue: true,
      sub: "Active tenants",
    },
    {
      href: "/contracts",
      icon: FileSignature,
      tint: "bg-slate-100 text-slate-600",
      title: "Contracts",
      sub: "Next 30 days",
      badge: moveOuts > 0 ? { text: `${moveOuts} ending`, tone: "amber" } : null,
    },
    {
      href: "/bookings",
      icon: CalendarCheck,
      tint: "bg-blue-50 text-blue-600",
      title: "Bookings",
      sub: "Viewings",
    },
  ];

  const actions = data.actions.slice(0, 4);
  const remaining = data.actions.length - actions.length;

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <p className="text-xs font-medium text-foreground-secondary">{today}</p>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          {greeting}, {userName}
        </h1>
      </div>

      {topSlot}

      {/* Needs attention */}
      <section className="rounded-2xl bg-surface-card p-4 shadow-bento">
        <div className="mb-3 flex items-center gap-2.5">
          <span
            className={
              "grid h-8 w-8 place-items-center rounded-lg " +
              (data.actions.length > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-500")
            }
          >
            {data.actions.length > 0 ? (
              <AlertTriangle className="h-4 w-4" strokeWidth={2} />
            ) : (
              <ShieldCheck className="h-4 w-4" strokeWidth={2} />
            )}
          </span>
          <h2 className="text-[15px] font-semibold text-foreground">Needs attention today</h2>
          {data.actions.length > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              {data.actions.length}
            </span>
          )}
        </div>

        {data.actions.length === 0 ? (
          <p className="py-4 text-center text-sm text-foreground-secondary">
            You&apos;re all caught up — nothing urgent right now.
          </p>
        ) : (
          <div className="space-y-2">
            {actions.map((a) => (
              <Link
                key={a.id}
                href={a.href}
                prefetch={false}
                className={"flex items-center gap-3 rounded-xl p-3 " + SEVERITY_ROW[a.severity]}
              >
                <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + SEVERITY_DOT[a.severity]} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{a.title}</span>
                  <span className="block truncate text-xs text-foreground-secondary">{a.subject}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-foreground-secondary">
                  {a.action_label}
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
            {remaining > 0 && (
              <p className="pt-1 text-center text-[11px] text-foreground-muted">
                +{remaining} more lower-priority {remaining === 1 ? "item" : "items"}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Big section tiles */}
      <section>
        <h2 className="mb-3 px-0.5 text-sm font-semibold text-foreground">Your portfolio</h2>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              prefetch={false}
              className="flex flex-col justify-between gap-3 rounded-2xl bg-surface-card p-4 shadow-bento transition-transform active:scale-[0.97]"
            >
              <div className="flex items-start justify-between">
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${t.tint}`}>
                  <t.icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                {t.badge && (
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums " +
                      (t.badge.tone === "red"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-800")
                    }
                  >
                    {t.badge.text}
                  </span>
                )}
              </div>
              <div>
                <div
                  className={
                    t.titleIsValue
                      ? "text-xl font-bold tabular-nums text-foreground"
                      : "text-[15px] font-semibold text-foreground"
                  }
                >
                  {t.title}
                </div>
                <div className="text-xs text-foreground-muted">{t.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

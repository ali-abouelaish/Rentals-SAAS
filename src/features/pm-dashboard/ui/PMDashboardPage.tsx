"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import {
  Home,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Clock,
  Building2,
  DollarSign,
  Activity,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  FileWarning,
  Banknote,
  PoundSterling,
  CalendarOff,
  Wrench,
} from "lucide-react";
import type {
  DashboardData,
  DashboardAction,
  DashboardActionSeverity,
  DashboardActionCategory,
} from "@/features/profitability/domain/types";
import { DashboardTodos } from "./DashboardTodos";
import type { PmTodo } from "../domain/todos";

// ──────────────────────────────────────────────────────────
// Formatters
// ──────────────────────────────────────────────────────────

function fmt(pence: number): string {
  const pounds = Math.abs(pence) / 100;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pounds);
}

function fmtPounds(pounds: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Math.abs(pounds));
}

// ──────────────────────────────────────────────────────────
// Portfolio Badge
// ──────────────────────────────────────────────────────────

function PortfolioBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}

// ──────────────────────────────────────────────────────────
// Action queue (the "needs attention today" centrepiece)
// ──────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<
  DashboardActionSeverity,
  { row: string; iconWrap: string; icon: string; dot: string }
> = {
  critical: {
    row: "border-red-200 bg-red-50/70 hover:bg-red-50",
    iconWrap: "bg-red-100",
    icon: "text-red-600",
    dot: "bg-red-500",
  },
  high: {
    row: "border-amber-200 bg-amber-50/60 hover:bg-amber-50",
    iconWrap: "bg-amber-100",
    icon: "text-amber-600",
    dot: "bg-amber-500",
  },
  medium: {
    row: "border-border bg-surface-inset hover:bg-surface-card",
    iconWrap: "bg-surface-card",
    icon: "text-foreground-secondary",
    dot: "bg-slate-400",
  },
};

const CATEGORY_ICON: Record<DashboardActionCategory, typeof Home> = {
  arrears: PoundSterling,
  deposit: ShieldAlert,
  maintenance: Wrench,
  move_out: CalendarOff,
  vacancy: Home,
  contract: FileWarning,
  cost: TrendingDown,
};

function ActionQueue({ actions }: { actions: DashboardAction[] }) {
  const MAX = 6;
  const shown = actions.slice(0, MAX);
  const remaining = actions.length - shown.length;
  const critical = actions.filter((a) => a.severity === "critical").length;

  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className={cn("p-2 rounded-lg", actions.length > 0 ? "bg-red-50" : "bg-emerald-50")}>
            {actions.length > 0 ? (
              <AlertTriangle className="h-4 w-4 text-red-600" strokeWidth={2} />
            ) : (
              <ShieldCheck className="h-4 w-4 text-emerald-500" strokeWidth={2} />
            )}
          </div>
          <h2 className="text-base font-semibold text-foreground">Needs attention today</h2>
          {actions.length > 0 && (
            <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
              {actions.length}
            </span>
          )}
        </div>
        {critical > 0 && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-red-600">
            {critical} critical
          </span>
        )}
      </div>

      {actions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 mb-3">
            <ShieldCheck className="h-6 w-6 text-emerald-500" strokeWidth={1.6} />
          </div>
          <p className="text-sm font-semibold text-foreground">You&apos;re all caught up</p>
          <p className="text-xs text-foreground-secondary mt-1 max-w-xs">
            No arrears, deadlines, or urgent tasks across your portfolio right now.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map((a) => {
            const s = SEVERITY_STYLES[a.severity];
            const Icon = CATEGORY_ICON[a.category];
            return (
              <Link
                key={a.id}
                href={a.href}
                className={cn(
                  "group flex items-center gap-3.5 p-3.5 rounded-xl border transition-colors",
                  s.row
                )}
              >
                <div className={cn("shrink-0 p-2 rounded-lg", s.iconWrap)}>
                  <Icon size={17} className={s.icon} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.dot)} />
                    <p className="text-sm font-semibold text-foreground truncate">{a.title}</p>
                  </div>
                  <p className="text-xs text-foreground-secondary truncate mt-0.5">{a.subject}</p>
                  <p className="text-[11px] text-foreground-muted truncate">{a.context}</p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-card border border-border text-foreground group-hover:border-brand group-hover:text-brand transition-colors">
                  {a.action_label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
          {remaining > 0 && (
            <p className="text-[11px] text-foreground-muted text-center pt-1">
              +{remaining} more lower-priority {remaining === 1 ? "item" : "items"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Compact KPI strip
// ──────────────────────────────────────────────────────────

const TONE: Record<string, { iconBg: string; icon: string; bar: string }> = {
  blue: { iconBg: "bg-blue-50", icon: "text-blue-600", bar: "bg-blue-500" },
  emerald: { iconBg: "bg-emerald-50", icon: "text-emerald-600", bar: "bg-emerald-500" },
  amber: { iconBg: "bg-amber-50", icon: "text-amber-600", bar: "bg-amber-500" },
  red: { iconBg: "bg-red-50", icon: "text-red-600", bar: "bg-red-500" },
  violet: { iconBg: "bg-violet-50", icon: "text-violet-600", bar: "bg-violet-500" },
};

type KpiDef = {
  label: string;
  value: string;
  sub: string;
  href: string;
  icon: typeof Home;
  tone: keyof typeof TONE;
  bar?: number;
};

function KpiCard({ label, value, sub, href, icon: Icon, tone, bar }: KpiDef) {
  const t = TONE[tone];
  return (
    <Link
      href={href}
      className="group rounded-bento bg-surface-card p-5 shadow-bento transition-all duration-base hover:shadow-bento-hover hover:-translate-y-0.5 block"
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">{label}</p>
        <div className={cn("p-2 rounded-lg", t.iconBg)}>
          <Icon className={cn("h-4 w-4", t.icon)} strokeWidth={1.8} />
        </div>
      </div>
      <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">{value}</p>
      {typeof bar === "number" && (
        <div className="mt-2 h-1.5 w-full rounded-full bg-surface-inset overflow-hidden">
          <div
            className={cn("h-full rounded-full", t.bar)}
            style={{ width: `${Math.min(100, Math.max(0, bar))}%` }}
          />
        </div>
      )}
      <p className="text-xs text-foreground-secondary mt-1.5">{sub}</p>
    </Link>
  );
}

function KpiStrip({ data }: { data: DashboardData }) {
  const occupancyPct =
    data.total_units > 0 ? Math.round((data.occupied_units / data.total_units) * 100) : 0;

  const kpis: KpiDef[] = [
    {
      label: "Occupancy",
      value: `${occupancyPct}%`,
      sub: `${data.occupied_units}/${data.total_units} units let`,
      href: "/properties",
      icon: Building2,
      tone: "blue",
      bar: occupancyPct,
    },
  ];

  if (data.collection) {
    const pct = data.collection.collected_pct;
    kpis.push({
      label: "Collected this month",
      value: `${pct}%`,
      sub:
        data.collection.tenants_behind > 0
          ? `${data.collection.tenants_behind} tenant${data.collection.tenants_behind === 1 ? "" : "s"} behind`
          : "everyone paid",
      href: "/rent-collection",
      icon: PoundSterling,
      tone: pct >= 90 ? "emerald" : pct >= 70 ? "amber" : "red",
      bar: pct,
    });
  } else {
    kpis.push({
      label: "Vacant",
      value: `${data.vacant_units}`,
      sub: `£${data.daily_vacancy_loss}/day loss`,
      href: "/properties?status=available",
      icon: AlertCircle,
      tone: data.vacant_units > 0 ? "amber" : "emerald",
    });
  }

  kpis.push({
    label: "Rent roll",
    value: `£${data.total_rent_roll.toLocaleString()}`,
    sub: "PCM contracted",
    href: "/rent-collection",
    icon: Banknote,
    tone: "violet",
  });

  kpis.push({
    label: "At risk",
    value: `£${Math.round(data.at_risk_total).toLocaleString()}`,
    sub: "arrears + vacancy lost",
    href: data.collection ? "/rent-collection" : "/properties?status=available",
    icon: AlertCircle,
    tone: data.at_risk_total > 0 ? "amber" : "emerald",
  });

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-[var(--gap-bento)]">
      {kpis.map((k) => (
        <KpiCard key={k.label} {...k} />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────

export type ActivityFeedItem = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_name: string;
  created_at: string;
  subject: string | null;
};

interface PMDashboardPageProps {
  data: DashboardData;
  userName: string;
  activity: ActivityFeedItem[];
  todos: PmTodo[];
  todoHistory: PmTodo[];
  todoProperties: { id: string; name: string }[];
}

export function PMDashboardPage({ data, userName, activity, todos, todoHistory, todoProperties }: PMDashboardPageProps) {
  const now = new Date();
  const today = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const attentionCount = data.actions.length;
  const summary = attentionCount > 0
    ? `${attentionCount} ${attentionCount === 1 ? "thing needs" : "things need"} your attention`
    : "Nothing urgent — portfolio is on track";
  const riskSuffix =
    data.at_risk_total > 0 ? ` · £${Math.round(data.at_risk_total).toLocaleString()} at risk` : "";

  const netTrend = data.portfolio_net_profit_this_month > data.portfolio_net_profit_last_month
    ? "up"
    : data.portfolio_net_profit_this_month < data.portfolio_net_profit_last_month
    ? "down"
    : "flat";

  return (
    <div className="space-y-6">

      {/* ── Greeting ─────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <p className="text-foreground-secondary text-sm">{today}</p>
          <h1 className="text-2xl font-bold tracking-tight font-heading text-foreground">
            {greeting}, {userName}
          </h1>
        </div>
        <p className="text-[13px] text-foreground-muted">
          {summary}
          {riskSuffix}
        </p>
      </div>

      {/* ── Needs attention today (action queue) ── */}
      <ActionQueue actions={data.actions} />

      {/* ── To-do list ── */}
      <DashboardTodos
        initialTodos={todos}
        initialHistory={todoHistory}
        properties={todoProperties}
      />

      {/* ── Compact KPI strip ── */}
      <KpiStrip data={data} />

      {/* ── Vacancy Overview + Upcoming Move-Outs (side by side) ── */}
      <div className="grid lg:grid-cols-2 gap-[var(--gap-bento)]">

        {/* Vacancy Overview */}
        <div className="rounded-bento bg-surface-card shadow-bento p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-50">
                <Home className="h-4 w-4 text-amber-600" strokeWidth={2} />
              </div>
              <h2 className="text-base font-semibold text-foreground">Vacancy Overview</h2>
            </div>
            <Link href="/properties?status=available" className="text-[13px] font-medium text-foreground-muted hover:text-brand transition-colors flex items-center gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {data.vacancy_units.length > 0 ? (
            <div className="space-y-2">
              {data.vacancy_units.map((unit) => (
                <div key={unit.unit_id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-inset">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">{unit.unit_label}</span>
                      <PortfolioBadge name={unit.portfolio_name} color={unit.portfolio_color} />
                    </div>
                    <p className="text-xs text-foreground-secondary truncate">{unit.property_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {unit.days_vacant > 0 ? (
                      <>
                        <p className="text-xs font-semibold text-amber-600">{unit.days_vacant}d vacant</p>
                        <p className="text-[11px] text-foreground-muted">£{unit.total_loss.toFixed(0)} lost</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-yellow-600">{unit.days_until_vacant}d remaining</p>
                        <p className="text-[11px] text-foreground-muted">Move-out</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" strokeWidth={1.5} />
              <p className="text-sm text-foreground-secondary">No vacancies right now</p>
            </div>
          )}
        </div>

        {/* Upcoming Move-Outs */}
        <div className="rounded-bento bg-surface-card shadow-bento p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-violet-50">
                <Calendar className="h-4 w-4 text-violet-600" strokeWidth={2} />
              </div>
              <h2 className="text-base font-semibold text-foreground">Upcoming Move-Outs</h2>
              <span className="text-xs text-foreground-muted">next 30 days</span>
            </div>
            <Link href="/contracts?filter=notice_given" className="text-[13px] font-medium text-foreground-muted hover:text-brand transition-colors flex items-center gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {data.upcoming_move_outs.length > 0 ? (
            <div className="space-y-2">
              {data.upcoming_move_outs.map((mu) => (
                <Link
                  key={mu.unit_id}
                  href={`/contracts`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-inset hover:bg-amber-50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {mu.tenant_name ?? "Unknown"}
                    </p>
                    <p className="text-xs text-foreground-secondary truncate">
                      {mu.unit_label} · {mu.property_name}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-amber-600">{mu.days_remaining}d</p>
                    <p className="text-[11px] text-foreground-muted">
                      {new Date(mu.vacate_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Clock className="h-8 w-8 text-foreground-muted mb-2" strokeWidth={1.5} />
              <p className="text-sm text-foreground-secondary">No move-outs in the next 30 days</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Maintenance Summary ── */}
      <div className="rounded-bento bg-surface-card shadow-bento p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-orange-50">
              <Wrench className="h-4 w-4 text-orange-600" strokeWidth={2} />
            </div>
            <h2 className="text-base font-semibold text-foreground">Maintenance</h2>
            {data.maintenance_summary.critical_jobs > 0 && (
              <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                {data.maintenance_summary.critical_jobs} critical
              </span>
            )}
          </div>
          <Link
            href="/maintenance"
            className="text-[13px] font-medium text-foreground-muted hover:text-brand transition-colors flex items-center gap-1"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Open",
              value: data.maintenance_summary.open_jobs,
              color: "text-slate-700",
              bg: "bg-slate-50",
            },
            {
              label: "In Progress",
              value: data.maintenance_summary.in_progress_jobs,
              color: "text-blue-700",
              bg: "bg-blue-50",
            },
            {
              label: "Resolved this month",
              value: data.maintenance_summary.resolved_this_month,
              color: "text-emerald-700",
              bg: "bg-emerald-50",
            },
            {
              label: "Cost this month",
              value:
                data.maintenance_summary.total_cost_this_month > 0
                  ? `£${Math.round(data.maintenance_summary.total_cost_this_month / 100).toLocaleString()}`
                  : "£0",
              color: "text-orange-700",
              bg: "bg-orange-50",
              isString: true,
            },
          ].map((stat) => (
            <Link
              key={stat.label}
              href="/maintenance"
              className={cn(
                "flex flex-col p-4 rounded-xl transition-opacity hover:opacity-80",
                stat.bg
              )}
            >
              <span className={cn("text-2xl font-bold tabular-nums", stat.color)}>
                {stat.value}
              </span>
              <span className={cn("text-xs font-medium mt-1", stat.color, "opacity-70")}>
                {stat.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Profitability Snapshot ── */}
      <div className="rounded-bento bg-surface-card shadow-bento p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-subtle">
              <TrendingUp className="h-4 w-4 text-brand" strokeWidth={2} />
            </div>
            <h2 className="text-base font-semibold text-foreground">Profitability Snapshot</h2>
          </div>
          <Link
            href="/profitability"
            className="text-[13px] font-medium text-foreground-muted hover:text-brand transition-colors flex items-center gap-1"
          >
            Full view <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Portfolio total + trend */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-inset mb-4">
          <div>
            <p className="text-xs text-foreground-muted">Portfolio net profit this month</p>
            <p className={cn(
              "text-2xl font-bold tabular-nums",
              data.portfolio_net_profit_this_month >= 0 ? "text-emerald-600" : "text-red-600"
            )}>
              {data.portfolio_net_profit_this_month < 0 ? "-" : ""}
              £{Math.abs(data.portfolio_net_profit_this_month).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {netTrend === "up" && <TrendingUp className="h-5 w-5 text-emerald-500" />}
            {netTrend === "down" && <TrendingDown className="h-5 w-5 text-red-500" />}
            {netTrend === "flat" && <Minus className="h-5 w-5 text-foreground-muted" />}
            <span className="text-sm text-foreground-secondary">
              vs £{Math.abs(data.portfolio_net_profit_last_month).toLocaleString()} last month
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Best Performing */}
          <div>
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Top Performers</p>
            <div className="space-y-1.5">
              {data.top_properties.map((p) => (
                <Link
                  key={p.property_id}
                  href={`/profitability/${p.property_id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{p.property_name}</span>
                    <PortfolioBadge name={p.portfolio_name} color={p.portfolio_color} />
                  </div>
                  <span className="text-sm font-semibold text-emerald-700 tabular-nums ml-2 shrink-0">
                    +{fmt(p.net_profit)}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Worst Performing */}
          <div>
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">Needs Attention</p>
            <div className="space-y-1.5">
              {data.worst_properties.map((p) => (
                <Link
                  key={p.property_id}
                  href={`/profitability/${p.property_id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <TrendingDown className="h-3.5 w-3.5 text-red-600 shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{p.property_name}</span>
                    <PortfolioBadge name={p.portfolio_name} color={p.portfolio_color} />
                  </div>
                  <span className="text-sm font-semibold text-red-700 tabular-nums ml-2 shrink-0">
                    -{fmtPounds(Math.abs(p.net_profit) / 100)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Activity Feed ── */}
      <div className="rounded-bento bg-surface-card shadow-bento p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-lg bg-brand-subtle">
            <Activity className="h-4 w-4 text-brand" strokeWidth={2} />
          </div>
          <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
        </div>

        {activity.length > 0 ? (
          <div className="space-y-1">
            {activity.map((item) => {
              const cfg = activityIconFor(item.action, item.entity_type);
              return (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-surface-inset transition-colors">
                  <div className={cn("mt-0.5 p-1.5 rounded-lg shrink-0", cfg.bgClass)}>
                    <cfg.Icon size={13} className={cfg.iconClass} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">
                      <span className="font-medium">{item.actor_name}</span>{" "}
                      <span className="text-foreground-secondary">{humaniseAction(item.action)}</span>
                      {item.subject && <> <span className="font-medium">{item.subject}</span></>}
                    </p>
                    <p className="text-xs text-foreground-muted">{relativeTime(item.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-foreground-muted py-4 text-center">No recent activity yet.</p>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Activity feed presentation helpers
// ──────────────────────────────────────────────────────────

function humaniseAction(action: string): string {
  return action.replaceAll("_", " ");
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function activityIconFor(action: string, entityType: string): {
  Icon: typeof Activity; bgClass: string; iconClass: string;
} {
  if (action.includes("payment") || action.includes("rent")) {
    return { Icon: DollarSign, bgClass: "bg-emerald-50", iconClass: "text-emerald-600" };
  }
  if (action.includes("notice") || action.includes("vacate")) {
    return { Icon: Calendar, bgClass: "bg-amber-50", iconClass: "text-amber-600" };
  }
  if (action.includes("contract") || action.includes("sign")) {
    return { Icon: Building2, bgClass: "bg-blue-50", iconClass: "text-blue-600" };
  }
  if (action.includes("book") || action.includes("approve")) {
    return { Icon: CheckCircle2, bgClass: "bg-emerald-50", iconClass: "text-emerald-600" };
  }
  if (action.includes("maintenance") || entityType === "maintenance_job") {
    return { Icon: Wrench, bgClass: "bg-violet-50", iconClass: "text-violet-600" };
  }
  return { Icon: Activity, bgClass: "bg-brand-subtle", iconClass: "text-brand" };
}

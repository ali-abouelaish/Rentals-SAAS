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
  FileWarning,
  Banknote,
  CalendarOff,
  Wrench,
} from "lucide-react";
import type { DashboardData, ProfitabilityAlert, AlertType } from "@/features/profitability/domain/types";
import { ALERT_CONFIG } from "@/features/profitability/domain/types";

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

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ──────────────────────────────────────────────────────────
// Alert type → icon + colours
// ──────────────────────────────────────────────────────────

const ALERT_ICON_MAP: Record<AlertType, { Icon: typeof AlertTriangle; urgencyClass: string; bgClass: string; borderClass: string }> = {
  profitability_below_target: { Icon: TrendingDown, urgencyClass: "text-red-600", bgClass: "bg-red-50", borderClass: "border-red-200" },
  vacancy_running:            { Icon: Home,         urgencyClass: "text-amber-600", bgClass: "bg-amber-50", borderClass: "border-amber-200" },
  vacancy_upcoming:           { Icon: Calendar,     urgencyClass: "text-yellow-600", bgClass: "bg-yellow-50", borderClass: "border-yellow-200" },
  cost_spike:                 { Icon: AlertTriangle, urgencyClass: "text-orange-600", bgClass: "bg-orange-50", borderClass: "border-orange-200" },
  deposit_deadline:           { Icon: ShieldAlert,  urgencyClass: "text-red-600", bgClass: "bg-red-50", borderClass: "border-red-200" },
  landlord_contract_expiry:   { Icon: FileWarning,  urgencyClass: "text-red-600", bgClass: "bg-red-50", borderClass: "border-red-200" },
  notice_vacate_approaching:  { Icon: CalendarOff,  urgencyClass: "text-amber-600", bgClass: "bg-amber-50", borderClass: "border-amber-200" },
};

function alertDescription(alert: ProfitabilityAlert): string {
  const m = alert.metadata as Record<string, unknown>;
  switch (alert.alert_type) {
    case "profitability_below_target":
      return `Below £${m.target_pcm} target for ${m.months_below} months. Currently ${Number(m.actual_pcm) < 0 ? "-" : ""}£${Math.abs(Number(m.actual_pcm))}/mo.`;
    case "vacancy_running":
      return `${m.days_vacant} days vacant · £${Math.round(Number(m.total_loss) / 100)} lost so far`;
    case "vacancy_upcoming":
      return `Becomes vacant in ${m.days_until_vacant} days`;
    case "cost_spike":
      return `${m.cost_label ?? m.cost_type} of ${fmt(Number(m.amount))} logged — pushed below target`;
    case "deposit_deadline":
      return `${m.deposit_scheme} protection deadline in ${m.days_until_deadline} days`;
    case "landlord_contract_expiry":
      return `${m.owner_landlord_name} — contract expires in ${m.days_until_expiry} days`;
    case "notice_vacate_approaching":
      return `${m.tenant_name} vacates in ${m.days_until_vacate} days`;
    default:
      return "";
  }
}

function alertAction(alert: ProfitabilityAlert): { label: string; href: string } {
  switch (alert.alert_type) {
    case "profitability_below_target":
    case "cost_spike":
      return { label: "View P&L", href: `/profitability/${alert.property_id}` };
    case "vacancy_running":
    case "vacancy_upcoming":
      return { label: "View Unit", href: `/properties?unit=${alert.unit_id}` };
    case "deposit_deadline":
      return { label: "View Contract", href: `/contracts` };
    case "landlord_contract_expiry":
      return { label: "View Property", href: `/properties/${alert.property_id}` };
    case "notice_vacate_approaching":
      return { label: "View Unit", href: `/properties?unit=${alert.unit_id}` };
    default:
      return { label: "View", href: "/profitability" };
  }
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
}

export function PMDashboardPage({ data, userName, activity }: PMDashboardPageProps) {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const occupancyPct = data.total_units > 0
    ? Math.round((data.occupied_units / data.total_units) * 100)
    : 0;

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
            Welcome back, {userName}
          </h1>
        </div>
        <p className="text-[13px] text-foreground-muted">Portfolio overview</p>
      </div>

      {/* ── Section 1: Portfolio Summary (4 stat cards) ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-[var(--gap-bento)]">
        {/* Total Units */}
        <Link href="/properties" className="group rounded-bento bg-surface-card p-5 shadow-bento transition-all duration-base hover:shadow-bento-hover hover:-translate-y-0.5 block">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">Total Units</p>
              <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">{data.total_units}</p>
              <p className="text-xs text-foreground-secondary mt-1">across all properties</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50">
              <Building2 className="h-5 w-5 text-blue-600" strokeWidth={1.8} />
            </div>
          </div>
        </Link>

        {/* Occupied */}
        <Link href="/properties?status=occupied" className="group rounded-bento bg-surface-card p-5 shadow-bento transition-all duration-base hover:shadow-bento-hover hover:-translate-y-0.5 block">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">Occupied</p>
              <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">{data.occupied_units}</p>
              <p className="text-xs text-foreground-secondary mt-1">{occupancyPct}% occupancy rate</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" strokeWidth={1.8} />
            </div>
          </div>
        </Link>

        {/* Vacant */}
        <Link href="/properties?status=available" className="group rounded-bento bg-surface-card p-5 shadow-bento transition-all duration-base hover:shadow-bento-hover hover:-translate-y-0.5 block">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">Vacant</p>
              <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">{data.vacant_units}</p>
              <p className="text-xs text-amber-600 font-medium mt-1">
                £{data.daily_vacancy_loss}/day loss
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50">
              <AlertCircle className="h-5 w-5 text-amber-600" strokeWidth={1.8} />
            </div>
          </div>
        </Link>

        {/* Rent Roll */}
        <Link href="/rent-collection" className="group rounded-bento bg-surface-card p-5 shadow-bento transition-all duration-base hover:shadow-bento-hover hover:-translate-y-0.5 block">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">Rent Roll</p>
              <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">
                £{data.total_rent_roll.toLocaleString()}
              </p>
              <p className="text-xs text-foreground-secondary mt-1">PCM contracted</p>
            </div>
            <div className="p-3 rounded-xl bg-violet-50">
              <Banknote className="h-5 w-5 text-violet-600" strokeWidth={1.8} />
            </div>
          </div>
        </Link>
      </div>

      {/* ── Section 2: Alerts Panel ── */}
      {data.alerts.length > 0 && (
        <div className="rounded-bento bg-surface-card shadow-bento p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" strokeWidth={2} />
              </div>
              <h2 className="text-base font-semibold text-foreground">Alerts</h2>
              <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                {data.alerts.filter((a) => !a.is_resolved).length}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {data.alerts.filter((a) => !a.is_resolved).map((alert) => {
              const cfg = ALERT_ICON_MAP[alert.alert_type];
              const action = alertAction(alert);
              return (
                <div
                  key={alert.id}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-xl border",
                    cfg.bgClass,
                    cfg.borderClass
                  )}
                >
                  <div className={cn("mt-0.5 shrink-0", cfg.urgencyClass)}>
                    <cfg.Icon size={18} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-semibold text-foreground">
                        {alert.property_name}
                      </span>
                      {alert.unit_label && (
                        <span className="text-xs text-foreground-secondary">· {alert.unit_label}</span>
                      )}
                      <PortfolioBadge
                        name={alert.portfolio_name ?? ""}
                        color={alert.portfolio_color ?? "#6b7280"}
                      />
                    </div>
                    <p className="text-xs text-foreground-secondary">
                      {ALERT_CONFIG[alert.alert_type].label} · {alertDescription(alert)}
                    </p>
                    <p className="text-[11px] text-foreground-muted mt-0.5">
                      {daysSince(alert.triggered_at)}d ago
                    </p>
                  </div>
                  <Link
                    href={action.href}
                    className={cn(
                      "shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
                      cfg.urgencyClass,
                      cfg.bgClass,
                      "hover:opacity-80"
                    )}
                  >
                    {action.label}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Section 3 + 4: Vacancy Overview + Upcoming Move-Outs (side by side) ── */}
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

      {/* ── Section 5: Maintenance Summary ── */}
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

      {/* ── Section 6: Profitability Snapshot ── */}
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

      {/* ── Section 7: Recent Activity Feed ── */}
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

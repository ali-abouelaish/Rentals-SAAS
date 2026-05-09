"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  ChevronDown,
  Filter,
  Search,
  X,
} from "lucide-react";
import type { PropertyProfitability, PortfolioMonthPoint } from "../domain/types";
import { PortfolioGraph } from "./PortfolioGraph";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function fmt(pence: number): string {
  const sign = pence < 0 ? "-" : "+";
  const pounds = Math.abs(pence) / 100;
  return (
    sign +
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(pounds)
  );
}

function fmtAbs(pence: number): string {
  const pounds = Math.abs(pence) / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pounds);
}

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

function TrendIcon({ trend }: { trend: PropertyProfitability["trend"] }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-foreground-muted" />;
}

// ──────────────────────────────────────────────────────────
// Row
// ──────────────────────────────────────────────────────────

function PropertyRow({ prop }: { prop: PropertyProfitability }) {
  const isProfit = prop.net_profit >= 0;
  const aboveTarget =
    prop.vs_target !== null ? prop.vs_target >= 0 : null;

  return (
    <Link
      href={`/profitability/${prop.property_id}`}
      className="flex items-center gap-4 p-4 rounded-xl hover:bg-surface-inset transition-colors group border border-transparent hover:border-border"
    >
      {/* Property name + portfolio */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors truncate">
            {prop.property_name}
          </span>
          <PortfolioBadge name={prop.portfolio_name} color={prop.portfolio_color} />
        </div>
        <p className="text-xs text-foreground-muted">
          {prop.occupied_units}/{prop.total_units} units occupied
        </p>
      </div>

      {/* Income */}
      <div className="hidden lg:block text-right w-24 shrink-0">
        <p className="text-xs text-foreground-muted mb-0.5">Income</p>
        <p className="text-sm font-medium text-foreground tabular-nums">{fmtAbs(prop.total_income)}</p>
      </div>

      {/* Costs */}
      <div className="hidden lg:block text-right w-24 shrink-0">
        <p className="text-xs text-foreground-muted mb-0.5">Costs</p>
        <p className="text-sm font-medium text-foreground tabular-nums">{fmtAbs(prop.total_costs)}</p>
      </div>

      {/* Re-let Gap (between tenants) */}
      <div
        className="hidden xl:block text-right w-24 shrink-0"
        title="Re-let Gap — lost rent on units that were previously let and are currently empty between tenants."
      >
        <p className="text-xs text-foreground-muted mb-0.5">Re-let Gap</p>
        <p className={cn("text-sm font-medium tabular-nums", prop.vacancy_loss > 0 ? "text-amber-600" : "text-foreground-muted")}>
          {prop.vacancy_loss > 0 ? `-${fmtAbs(prop.vacancy_loss)}` : "—"}
        </p>
      </div>

      {/* Pre-let Gap (before first tenant move-in) */}
      <div
        className="hidden xl:block text-right w-24 shrink-0"
        title="Pre-let Gap — lost rent between the property contract start (with the owner landlord) and the first tenant move-in. Subtracted from net profit once the room is let."
      >
        <p className="text-xs text-foreground-muted mb-0.5">Pre-let Gap</p>
        {!prop.property_contract_start_date ? (
          <p className="text-xs text-foreground-muted">—</p>
        ) : prop.total_pre_let_loss > 0 ? (
          <p className="text-sm font-medium tabular-nums text-red-600">
            -{fmtAbs(prop.total_pre_let_loss)}
          </p>
        ) : prop.total_pre_let_days > 0 ? (
          <p className="text-sm font-medium tabular-nums text-amber-600">
            {prop.total_pre_let_days}d
          </p>
        ) : (
          <p className="text-sm font-medium tabular-nums text-foreground-muted">—</p>
        )}
      </div>

      {/* Net Profit */}
      <div className="text-right w-28 shrink-0">
        <p className="text-xs text-foreground-muted mb-0.5">Net Profit</p>
        <p className={cn("text-sm font-bold tabular-nums", isProfit ? "text-emerald-600" : "text-red-600")}>
          {fmt(prop.net_profit)}
        </p>
      </div>

      {/* vs Target */}
      <div className="hidden sm:block text-right w-24 shrink-0">
        <p className="text-xs text-foreground-muted mb-0.5">vs Target</p>
        {prop.vs_target !== null ? (
          <p className={cn("text-sm font-medium tabular-nums", aboveTarget ? "text-emerald-600" : "text-red-600")}>
            {fmt(prop.vs_target)}
          </p>
        ) : (
          <p className="text-xs text-foreground-muted">—</p>
        )}
      </div>

      {/* Trend */}
      <div className="hidden sm:flex items-center gap-1 w-8 shrink-0 justify-end">
        <TrendIcon trend={prop.trend} />
      </div>

      <ArrowRight className="h-4 w-4 text-foreground-muted group-hover:text-brand transition-colors shrink-0" />
    </Link>
  );
}

// ──────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────

interface ProfitabilityPageProps {
  properties: PropertyProfitability[];
  graphData: PortfolioMonthPoint[];
}

export function ProfitabilityPage({ properties, graphData }: ProfitabilityPageProps) {
  const [portfolioFilter, setPortfolioFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"actual" | "projected">("actual");
  const [search, setSearch] = useState("");

  // Unique portfolios
  const portfolios = useMemo(() => {
    const seen = new Map<string, { name: string; color: string }>();
    for (const p of properties) {
      if (!seen.has(p.portfolio_id)) {
        seen.set(p.portfolio_id, { name: p.portfolio_name, color: p.portfolio_color });
      }
    }
    return Array.from(seen.values());
  }, [properties]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties.filter((p) => {
      if (portfolioFilter !== "all" && p.portfolio_name !== portfolioFilter) return false;
      if (!q) return true;
      return (
        p.property_name.toLowerCase().includes(q) ||
        p.portfolio_name.toLowerCase().includes(q)
      );
    });
  }, [properties, portfolioFilter, search]);

  // Summary stats
  const totalIncome = filtered.reduce((s, p) => s + p.total_income, 0);
  const totalCosts = filtered.reduce((s, p) => s + p.total_costs, 0);
  const totalVacancy = filtered.reduce((s, p) => s + p.vacancy_loss, 0);
  const totalPreLetLoss = filtered.reduce((s, p) => s + p.total_pre_let_loss, 0);
  const totalNet = filtered.reduce((s, p) => s + p.net_profit, 0);
  const aboveTarget = filtered.filter(
    (p) => p.vs_target !== null && p.vs_target >= 0
  ).length;
  const belowTarget = filtered.filter(
    (p) => p.vs_target !== null && p.vs_target < 0
  ).length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading text-foreground">
            Profitability
          </h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Portfolio P&amp;L · {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
        </div>
        {/* View toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden self-start sm:self-auto">
          {(["actual", "projected"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={cn(
                "px-4 py-2 text-xs font-semibold capitalize transition-colors",
                viewMode === v
                  ? "bg-brand text-brand-fg"
                  : "text-foreground-secondary hover:bg-surface-inset"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-[var(--gap-bento)]">
        {[
          { label: "Total Income", value: fmtAbs(totalIncome), color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Total Costs", value: fmtAbs(totalCosts), color: "text-red-600", bg: "bg-red-50" },
          { label: "Re-let Gap Loss", value: fmtAbs(totalVacancy), color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Pre-let Gap Loss", value: fmtAbs(totalPreLetLoss), color: "text-red-600", bg: "bg-red-50" },
          {
            label: "Net Profit",
            value: fmt(totalNet),
            color: totalNet >= 0 ? "text-emerald-600" : "text-red-600",
            bg: totalNet >= 0 ? "bg-emerald-50" : "bg-red-50",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-bento bg-surface-card p-5 shadow-bento">
            <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">{s.label}</p>
            <p className={cn("text-2xl font-bold mt-2 tabular-nums", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Target summary */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          <TrendingUp size={12} /> {aboveTarget} above target
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
          <TrendingDown size={12} /> {belowTarget} below target
        </span>
        <span className="text-xs text-foreground-muted">
          {filtered.filter((p) => p.target_profit === null).length} without target
        </span>
      </div>

      {/* Portfolio Graph */}
      <div className="rounded-bento bg-surface-card shadow-bento p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Net Profit by Portfolio</h2>
        <PortfolioGraph data={graphData} portfolios={portfolios} />
      </div>

      {/* Property table */}
      <div className="rounded-bento bg-surface-card shadow-bento p-6">
        {/* Table header + filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-foreground">All Properties</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <label className="relative">
              <span className="sr-only">Search properties</span>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search property…"
                className="bg-surface-inset border border-border rounded-lg pl-8 pr-7 py-1.5 text-xs font-medium text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-brand w-48"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-surface-card text-foreground-muted hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </label>

            <Filter className="h-3.5 w-3.5 text-foreground-muted" />
            <div className="relative">
              <select
                value={portfolioFilter}
                onChange={(e) => setPortfolioFilter(e.target.value)}
                className="appearance-none bg-surface-inset border border-border rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
              >
                <option value="all">All portfolios</option>
                {portfolios.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-foreground-muted pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-4 px-4 py-2 text-[11px] font-semibold text-foreground-muted uppercase tracking-wider border-b border-border mb-1">
          <div className="flex-1">Property</div>
          <div className="hidden lg:block w-24 text-right">Income</div>
          <div className="hidden lg:block w-24 text-right">Costs</div>
          <div className="hidden xl:block w-24 text-right">Re-let Gap</div>
          <div className="hidden xl:block w-24 text-right">Pre-let Gap</div>
          <div className="w-28 text-right">Net Profit</div>
          <div className="hidden sm:block w-24 text-right">vs Target</div>
          <div className="hidden sm:block w-8" />
          <div className="w-4" />
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/50">
          {filtered.map((prop) => (
            <PropertyRow key={prop.property_id} prop={prop} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-foreground-muted">
            {search.trim()
              ? `No properties match “${search.trim()}”.`
              : "No properties match the current filter."}
          </div>
        )}
      </div>
    </div>
  );
}

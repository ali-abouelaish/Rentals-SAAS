"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  TrendingUp,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  ChevronRight,
  Calendar,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Evaluation } from "../domain/types";
import type { Portfolio } from "@/features/properties/domain/types";
import { LONDON_AREAS } from "../domain/types";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

const fmt = (pence: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pence / 100);

const STATUS_CONFIG = {
  considering: {
    label: "Considering",
    color: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    icon: Clock,
  },
  taken_on: {
    label: "Taken On",
    color: "bg-green-500/10 text-green-400 border border-green-500/20",
    icon: CheckCircle2,
  },
  passed: {
    label: "Passed",
    color: "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",
    icon: XCircle,
  },
} as const;

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  hmo: "HMO",
  studio: "Studio",
  whole_flat: "Whole Flat",
};

// ──────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────

interface AcquisitionInsightsPageProps {
  evaluations: Evaluation[];
  portfolios: Portfolio[];
}

// ──────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────

export function AcquisitionInsightsPage({
  evaluations,
  portfolios,
}: AcquisitionInsightsPageProps) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [filterPortfolio, setFilterPortfolio] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterType, setFilterType] = useState("");

  const filtered = useMemo(() => {
    return evaluations.filter((e) => {
      if (search && !e.address.toLowerCase().includes(search.toLowerCase()) &&
        !e.postcode.toLowerCase().includes(search.toLowerCase()) &&
        !e.detected_area.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterPortfolio && e.portfolio_id !== filterPortfolio) return false;
      if (filterStatus && e.status !== filterStatus) return false;
      if (filterArea && e.detected_area !== filterArea) return false;
      if (filterType && e.property_type !== filterType) return false;
      return true;
    });
  }, [evaluations, search, filterPortfolio, filterStatus, filterArea, filterType]);

  // Summary stats
  const takenOn = evaluations.filter((e) => e.status === "taken_on");
  const avgBreakEven =
    takenOn.length > 0
      ? Math.round(takenOn.reduce((s, e) => s + e.break_even_months, 0) / takenOn.length)
      : 0;
  const avgRoi =
    takenOn.length > 0
      ? Math.round(takenOn.reduce((s, e) => s + e.annual_roi_percentage, 0) / takenOn.length * 10) / 10
      : 0;

  const selectClass =
    "h-9 rounded-lg border border-border bg-surface-card px-3 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Acquisition Insights
          </h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            AI-powered property evaluations and break-even analysis
          </p>
        </div>
        <Link
          href="/acquisition-insights/new"
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-brand-fg shadow-glow transition hover:opacity-90"
        >
          <Plus size={16} />
          New Evaluation
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={BarChart2}
          label="Total Evaluations"
          value={String(evaluations.length)}
          color="text-brand"
          bg="bg-brand/10"
        />
        <StatCard
          icon={CheckCircle2}
          label="Taken On"
          value={String(takenOn.length)}
          color="text-green-400"
          bg="bg-green-400/10"
        />
        <StatCard
          icon={Clock}
          label="Avg. Break-Even"
          value={takenOn.length ? `${avgBreakEven}mo` : "—"}
          color="text-amber-400"
          bg="bg-amber-400/10"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg. Annual ROI"
          value={takenOn.length ? `${avgRoi}%` : "—"}
          color="text-accent"
          bg="bg-accent/10"
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-secondary"
          />
          <input
            type="text"
            placeholder="Search address, area…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-surface-card pl-9 pr-3 text-[13px] text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <select
          value={filterPortfolio}
          onChange={(e) => setFilterPortfolio(e.target.value)}
          className={selectClass}
        >
          <option value="">All Portfolios</option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={selectClass}
        >
          <option value="">All Statuses</option>
          <option value="considering">Considering</option>
          <option value="taken_on">Taken On</option>
          <option value="passed">Passed</option>
        </select>

        <select
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
          className={selectClass}
        >
          <option value="">All Areas</option>
          {LONDON_AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className={selectClass}
        >
          <option value="">All Types</option>
          <option value="hmo">HMO</option>
          <option value="studio">Studio</option>
          <option value="whole_flat">Whole Flat</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <Search className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">
            No evaluations found
          </p>
          <p className="text-xs text-foreground-secondary">
            {evaluations.length === 0
              ? "Create your first property evaluation to get started."
              : "Try adjusting your filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-surface-raised">
                  <th className="px-4 py-3 text-left font-medium text-foreground-secondary">Property</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground-secondary">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground-secondary">Setup Cost</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground-secondary">Net / Month</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground-secondary">Break-Even</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground-secondary">ROI</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground-secondary">Created</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((ev) => {
                  const st = STATUS_CONFIG[ev.status];
                  const StIcon = st.icon;
                  const profitable = ev.monthly_net_profit > 0;

                  return (
                    <tr
                      key={ev.id}
                      className="hover:bg-surface-raised cursor-pointer transition-colors"
                      onClick={() => router.push(`/acquisition-insights/${ev.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground truncate max-w-[200px]">
                          {ev.address}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-foreground-secondary">{ev.detected_area}</span>
                          {ev.portfolio && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                              style={{ backgroundColor: ev.portfolio.color + "33", color: ev.portfolio.color }}
                            >
                              {ev.portfolio.name}
                            </span>
                          )}
                          <span className="text-xs text-foreground-secondary">
                            · {PROPERTY_TYPE_LABELS[ev.property_type]} · {ev.total_rooms} rooms
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[11px] font-semibold",
                              st.color
                            )}
                          >
                            <StIcon size={11} />
                            {st.label}
                          </span>
                          {ev.linked_property && (
                            <Link
                              href={`/properties?highlight=${ev.linked_property.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
                            >
                              <ExternalLink size={10} />
                              {ev.linked_property.name}
                            </Link>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="text-foreground font-medium">
                          {fmt(ev.total_setup_cost)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "font-semibold",
                            profitable ? "text-green-400" : "text-red-400"
                          )}
                        >
                          {profitable ? "+" : ""}
                          {fmt(ev.monthly_net_profit)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        {profitable ? (
                          <span className="text-foreground">{ev.break_even_months}mo</span>
                        ) : (
                          <span className="text-foreground-secondary text-xs">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {profitable && ev.annual_roi_percentage > 0 ? (
                          <span
                            className={cn(
                              "font-semibold",
                              ev.annual_roi_percentage >= 15
                                ? "text-green-400"
                                : ev.annual_roi_percentage >= 8
                                ? "text-amber-400"
                                : "text-foreground-secondary"
                            )}
                          >
                            {ev.annual_roi_percentage.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-foreground-secondary text-xs">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-foreground-secondary">
                          <Calendar size={12} />
                          <span>
                            {new Date(ev.created_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <ChevronRight size={16} className="text-foreground-secondary" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// StatCard
// ──────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4">
      <div className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl mb-3", bg)}>
        <Icon size={18} className={color} />
      </div>
      <div className="text-xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-foreground-secondary mt-0.5">{label}</div>
    </div>
  );
}

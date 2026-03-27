"use client";

import { Search, X, List, LayoutGrid } from "lucide-react";
import { BOOKING_STATUS_CONFIG, type BookingFilters, type BookingStatus } from "../domain/types";
import type { Portfolio } from "@/features/properties/domain/types";

interface BookingFilterBarProps {
  filters: BookingFilters;
  onChange: (f: BookingFilters) => void;
  portfolios: Portfolio[];
  view: "list" | "kanban";
  onViewChange: (v: "list" | "kanban") => void;
  total: number;
}

const inputCls =
  "h-9 rounded-lg border border-border bg-surface-card px-3 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const selectCls =
  "h-9 rounded-lg border border-border bg-surface-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

export function BookingFilterBar({
  filters,
  onChange,
  portfolios,
  view,
  onViewChange,
  total,
}: BookingFilterBarProps) {
  const update = (partial: Partial<BookingFilters>) => onChange({ ...filters, ...partial });

  const hasActive =
    filters.search || filters.portfolioId || filters.status || filters.dateFrom || filters.dateTo;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search applicant, property…"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className={`${inputCls} pl-8 w-52`}
        />
      </div>

      {/* Portfolio */}
      {portfolios.length > 0 && (
        <select
          value={filters.portfolioId}
          onChange={(e) => update({ portfolioId: e.target.value })}
          className={`${selectCls} w-40`}
        >
          <option value="">All portfolios</option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}

      {/* Status */}
      <select
        value={filters.status}
        onChange={(e) => update({ status: e.target.value as BookingStatus | "" })}
        className={`${selectCls} w-40`}
      >
        <option value="">All statuses</option>
        {Object.entries(BOOKING_STATUS_CONFIG).map(([v, cfg]) => (
          <option key={v} value={v}>{cfg.label}</option>
        ))}
      </select>

      {/* Date from/to */}
      <input
        type="date"
        value={filters.dateFrom}
        onChange={(e) => update({ dateFrom: e.target.value })}
        className={`${inputCls} w-36`}
        title="From date"
      />
      <input
        type="date"
        value={filters.dateTo}
        onChange={(e) => update({ dateTo: e.target.value })}
        className={`${inputCls} w-36`}
        title="To date"
      />

      {/* Clear */}
      {hasActive && (
        <button
          type="button"
          onClick={() => onChange({ search: "", portfolioId: "", status: "", dateFrom: "", dateTo: "" })}
          className="flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-surface-inset transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}

      <span className="ml-auto text-xs text-foreground-muted">{total} booking{total !== 1 ? "s" : ""}</span>

      {/* View toggle */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-inset p-0.5">
        <button
          type="button"
          onClick={() => onViewChange("list")}
          className={`rounded-md p-1.5 transition-colors ${view === "list" ? "bg-surface-card shadow-sm text-foreground" : "text-foreground-muted hover:text-foreground"}`}
          title="List view"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onViewChange("kanban")}
          className={`rounded-md p-1.5 transition-colors ${view === "kanban" ? "bg-surface-card shadow-sm text-foreground" : "text-foreground-muted hover:text-foreground"}`}
          title="Kanban view"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Search, List, LayoutGrid, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  UNIT_STATUSES,
  STATUS_CONFIG,
  type UnitFilters,
  type UnitStatus,
  type UnitType,
  type RoomType,
  type Portfolio,
} from "../domain/types";

type ViewMode = "list" | "kanban";

interface UnitFilterBarProps {
  filters: UnitFilters;
  onChange: (filters: UnitFilters) => void;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  portfolios: Portfolio[];
  totalUnits: number;
}

const UNIT_TYPES: { value: UnitType; label: string }[] = [
  { value: "room", label: "Room" },
  { value: "studio", label: "Studio" },
  { value: "whole_flat", label: "Whole Flat" },
];

const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "double", label: "Double" },
  { value: "master", label: "Master" },
  { value: "ensuite", label: "Ensuite" },
];

function FilterDropdown<T extends string>({
  label,
  options,
  selected,
  onChange,
  renderOption,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (v: T[]) => void;
  renderOption?: (opt: { value: T; label: string }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const toggle = (v: T) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  const activeCount = selected.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors",
          activeCount > 0
            ? "bg-brand text-brand-fg border-brand"
            : "bg-surface-card text-foreground-secondary border-border hover:bg-surface-inset hover:text-foreground"
        )}
      >
        {label}
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-white/20 text-[10px] font-semibold px-1">
            {activeCount}
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[140px] rounded-xl border border-border bg-surface-card shadow-lg py-1">
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-foreground-secondary hover:bg-surface-inset hover:text-foreground transition-colors"
              >
                <span
                  className={cn(
                    "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors",
                    checked ? "bg-brand border-brand" : "border-border"
                  )}
                >
                  {checked && (
                    <svg viewBox="0 0 8 8" className="h-2 w-2 text-brand-fg" fill="currentColor">
                      <path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {renderOption ? renderOption(opt) : opt.label}
              </button>
            );
          })}
          {activeCount > 0 && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={() => { onChange([]); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function UnitFilterBar({
  filters,
  onChange,
  view,
  onViewChange,
  portfolios,
  totalUnits,
}: UnitFilterBarProps) {
  const set = <K extends keyof UnitFilters>(key: K, value: UnitFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const hasActiveFilters =
    filters.search ||
    filters.portfolioIds.length > 0 ||
    filters.areas.length > 0 ||
    filters.unitTypes.length > 0 ||
    filters.roomTypes.length > 0 ||
    filters.statuses.length > 0 ||
    filters.availableFrom ||
    filters.availableTo ||
    filters.minPrice ||
    filters.maxPrice;

  const clearAll = () =>
    onChange({
      search: "",
      portfolioIds: [],
      areas: [],
      unitTypes: [],
      roomTypes: [],
      statuses: [],
      availableFrom: "",
      availableTo: "",
      minPrice: "",
      maxPrice: "",
    });

  const showRoomTypes =
    filters.unitTypes.length === 0 || filters.unitTypes.includes("room");

  return (
    <div className="rounded-xl border border-border bg-surface-inset p-4 space-y-3">
      {/* Row 1: Search + dropdowns + view toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
          <input
            type="text"
            placeholder="Search unit, address, tenant…"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            className="h-8 w-full rounded-lg border border-border bg-surface-card pl-9 pr-3 text-xs placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => set("search", "")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        {portfolios.length > 0 && (
          <FilterDropdown
            label="Portfolio"
            options={portfolios.map((p) => ({ value: p.id, label: p.name }))}
            selected={filters.portfolioIds}
            onChange={(v) => set("portfolioIds", v)}
          />
        )}

        <FilterDropdown
          label="Status"
          options={UNIT_STATUSES.map((s) => ({ value: s, label: STATUS_CONFIG[s].label }))}
          selected={filters.statuses}
          onChange={(v) => set("statuses", v as UnitStatus[])}
          renderOption={(opt) => (
            <span className="flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_CONFIG[opt.value as UnitStatus].dot)} />
              {opt.label}
            </span>
          )}
        />

        <FilterDropdown
          label="Type"
          options={UNIT_TYPES}
          selected={filters.unitTypes}
          onChange={(v) => set("unitTypes", v as UnitType[])}
        />

        {showRoomTypes && (
          <FilterDropdown
            label="Room"
            options={ROOM_TYPES}
            selected={filters.roomTypes}
            onChange={(v) => set("roomTypes", v as RoomType[])}
          />
        )}

        {/* Price */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-foreground-muted">£</span>
          <input
            type="number"
            placeholder="Min"
            value={filters.minPrice}
            onChange={(e) => set("minPrice", e.target.value)}
            className="h-8 w-16 rounded-lg border border-border bg-surface-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand/30"
          />
          <span className="text-xs text-foreground-muted">–</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.maxPrice}
            onChange={(e) => set("maxPrice", e.target.value)}
            className="h-8 w-16 rounded-lg border border-border bg-surface-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand/30"
          />
        </div>

        {/* Available dates */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-foreground-muted whitespace-nowrap">Avail.</span>
          <input
            type="date"
            value={filters.availableFrom}
            onChange={(e) => set("availableFrom", e.target.value)}
            className="h-8 rounded-lg border border-border bg-surface-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand/30"
          />
          <span className="text-xs text-foreground-muted">–</span>
          <input
            type="date"
            value={filters.availableTo}
            onChange={(e) => set("availableTo", e.target.value)}
            className="h-8 rounded-lg border border-border bg-surface-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand/30"
          />
        </div>

        {/* Right side: clear + count + view toggle */}
        <div className="ml-auto flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 text-xs text-foreground-secondary hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
          <span className="text-xs text-foreground-muted">{totalUnits} units</span>
          <div className="flex items-center rounded-lg border border-border bg-surface-card overflow-hidden">
            <button
              type="button"
              onClick={() => onViewChange("list")}
              className={cn(
                "flex h-8 w-8 items-center justify-center transition-colors",
                view === "list"
                  ? "bg-brand text-brand-fg"
                  : "text-foreground-muted hover:text-foreground hover:bg-surface-inset"
              )}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewChange("kanban")}
              className={cn(
                "flex h-8 w-8 items-center justify-center transition-colors",
                view === "kanban"
                  ? "bg-brand text-brand-fg"
                  : "text-foreground-muted hover:text-foreground hover:bg-surface-inset"
              )}
              title="Kanban view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

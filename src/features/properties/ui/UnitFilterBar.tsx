"use client";

import { Search, List, LayoutGrid, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  UNIT_STATUSES,
  LONDON_AREAS,
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

function MultiToggle<T extends string>({
  options,
  value,
  onChange,
  renderOption,
}: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  renderOption?: (opt: { value: T; label: string }) => React.ReactNode;
}) {
  const toggle = (v: T) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => {
        const active = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium border transition-all duration-100",
              active
                ? "bg-brand text-brand-fg border-brand shadow-sm"
                : "bg-surface-card text-foreground-secondary border-border hover:bg-surface-inset hover:text-foreground"
            )}
          >
            {renderOption ? renderOption(opt) : opt.label}
          </button>
        );
      })}
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
      {/* Row 1: Search + View toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
          <input
            type="text"
            placeholder="Search unit, address, tenant…"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-surface-card pl-9 pr-3 text-sm placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
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

        <div className="ml-auto flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 text-xs text-foreground-secondary hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Clear filters
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

      {/* Row 2: Portfolio + Status */}
      <div className="flex flex-wrap items-center gap-4">
        {portfolios.length > 0 && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium text-foreground-muted whitespace-nowrap">Portfolio</span>
            <div className="flex flex-wrap gap-1">
              {portfolios.map((p) => {
                const active = filters.portfolioIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      set(
                        "portfolioIds",
                        active
                          ? filters.portfolioIds.filter((x) => x !== p.id)
                          : [...filters.portfolioIds, p.id]
                      )
                    }
                    className={cn(
                      "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide border transition-all",
                      active ? "shadow-sm" : "opacity-60 hover:opacity-100"
                    )}
                    style={
                      active
                        ? { backgroundColor: `${p.color}22`, color: p.color, borderColor: `${p.color}66` }
                        : { backgroundColor: "transparent", color: p.color, borderColor: `${p.color}44` }
                    }
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground-muted whitespace-nowrap">Status</span>
          <MultiToggle
            options={UNIT_STATUSES.map((s) => ({ value: s, label: STATUS_CONFIG[s].label }))}
            value={filters.statuses}
            onChange={(v) => set("statuses", v as UnitStatus[])}
            renderOption={(opt) => (
              <>
                <span
                  className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_CONFIG[opt.value as UnitStatus].dot)}
                />
                {opt.label}
              </>
            )}
          />
        </div>
      </div>

      {/* Row 3: Unit type + Room type + Price */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground-muted whitespace-nowrap">Type</span>
          <MultiToggle
            options={UNIT_TYPES}
            value={filters.unitTypes}
            onChange={(v) => set("unitTypes", v as UnitType[])}
          />
        </div>

        {showRoomTypes && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground-muted whitespace-nowrap">Room</span>
            <MultiToggle
              options={ROOM_TYPES}
              value={filters.roomTypes}
              onChange={(v) => set("roomTypes", v as RoomType[])}
            />
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs font-medium text-foreground-muted whitespace-nowrap">Price</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-foreground-muted">£</span>
            <input
              type="number"
              placeholder="Min"
              value={filters.minPrice}
              onChange={(e) => set("minPrice", e.target.value)}
              className="h-7 w-16 rounded-md border border-border bg-surface-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand/30"
            />
            <span className="text-xs text-foreground-muted">–</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.maxPrice}
              onChange={(e) => set("maxPrice", e.target.value)}
              className="h-7 w-16 rounded-md border border-border bg-surface-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand/30"
            />
          </div>

          <span className="text-xs font-medium text-foreground-muted whitespace-nowrap">Available</span>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={filters.availableFrom}
              onChange={(e) => set("availableFrom", e.target.value)}
              className="h-7 rounded-md border border-border bg-surface-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand/30"
            />
            <span className="text-xs text-foreground-muted">–</span>
            <input
              type="date"
              value={filters.availableTo}
              onChange={(e) => set("availableTo", e.target.value)}
              className="h-7 rounded-md border border-border bg-surface-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand/30"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

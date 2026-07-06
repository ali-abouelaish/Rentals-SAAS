"use client";

import { useMemo, useState } from "react";
import { differenceInDays, parseISO } from "date-fns";
import { ArrowDown, ArrowUp, ChevronsUpDown, Clock, Download, Rows2, Rows3, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { UnitStatusControl } from "./UnitStatusControl";
import type { UnitStatusChange } from "./StatusPickerDialog";
import { STATUS_CONFIG, UNIT_STATUSES, type Unit } from "../domain/types";

/* ------------------------------------------------------------------ helpers */

function formatPrice(min: number | null, max: number | null): string {
  if (!min && !max) return "—";
  if (min && max && min !== max) return `£${min.toLocaleString()}–£${max.toLocaleString()}`;
  return `£${(max ?? min)!.toLocaleString()}`;
}

function priceValue(u: Unit): number | null {
  return u.max_price_pcm ?? u.min_price_pcm ?? null;
}

function formatUnitLabel(unit: Unit): string {
  if (unit.unit_type === "room") {
    const roomLabel = unit.room_type
      ? unit.room_type.charAt(0).toUpperCase() + unit.room_type.slice(1)
      : "Room";
    return unit.room_number ? `Room ${unit.room_number} · ${roomLabel}` : roomLabel;
  }
  if (unit.unit_type === "studio") return "Studio";
  return "Whole Flat";
}

function formatUnitType(unit: Unit): string {
  if (unit.unit_type === "room") return unit.room_type
    ? `Room · ${unit.room_type.charAt(0).toUpperCase() + unit.room_type.slice(1)}`
    : "Room";
  if (unit.unit_type === "studio") return "Studio";
  return "Whole Flat";
}

function getDaysEmpty(unit: Unit): number | null {
  if (!["available", "move_out", "replacement"].includes(unit.status)) return null;
  if (!unit.available_date) return null;
  try {
    const days = differenceInDays(new Date(), parseISO(unit.available_date));
    return days >= 0 ? days : null;
  } catch {
    return null;
  }
}

function tenantName(unit: Unit): string | null {
  return unit.pm_tenant?.full_name ?? unit.resident?.full_name ?? null;
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
  } catch {
    return "—";
  }
}

/* ------------------------------------------------------------------ columns */

type SortValue = string | number | null;
type Align = "left" | "right" | "center";

interface ColumnDef {
  key: string;
  label: string;
  align?: Align;
  /** value used for sorting + numeric detection; null always sorts last */
  sortValue: (u: Unit) => SortValue;
  /** cell contents */
  cell: (u: Unit, ctx: CellCtx) => React.ReactNode;
  /** plain value for CSV export */
  csv: (u: Unit) => string;
  /** optional column total shown in the sticky footer */
  foot?: (units: Unit[]) => React.ReactNode;
}

interface CellCtx {
  onStatusChanged: (change: UnitStatusChange) => void;
}

const COLUMNS: ColumnDef[] = [
  {
    key: "property",
    label: "Property",
    sortValue: (u) => u.property?.name?.toLowerCase() ?? "",
    cell: (u) => (
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">{u.property?.name ?? "—"}</div>
        {(u.property?.area || u.property?.postcode) && (
          <div className="truncate text-[11px] text-foreground-muted">
            {[u.property?.area, u.property?.postcode].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
    ),
    csv: (u) => u.property?.name ?? "",
    foot: (units) => `${units.length} ${units.length === 1 ? "unit" : "units"}`,
  },
  {
    key: "unit",
    label: "Unit",
    sortValue: (u) => formatUnitLabel(u).toLowerCase(),
    cell: (u) => <span className="text-foreground">{formatUnitLabel(u)}</span>,
    csv: (u) => formatUnitLabel(u),
  },
  {
    key: "status",
    label: "Status",
    sortValue: (u) => UNIT_STATUSES.indexOf(u.status),
    cell: (u, ctx) => (
      <UnitStatusControl
        unitId={u.id}
        status={u.status}
        availableDate={u.available_date}
        onChanged={ctx.onStatusChanged}
        size="sm"
      />
    ),
    csv: (u) => STATUS_CONFIG[u.status]?.label ?? u.status,
  },
  {
    key: "available",
    label: "Available",
    sortValue: (u) => u.available_date ?? null,
    cell: (u) => <span className="text-foreground-secondary">{shortDate(u.available_date)}</span>,
    csv: (u) => u.available_date ?? "",
  },
  {
    key: "vacant",
    label: "Vacant",
    align: "right",
    sortValue: (u) => getDaysEmpty(u),
    cell: (u) => {
      const d = getDaysEmpty(u);
      if (d === null) return <span className="text-foreground-muted">—</span>;
      return (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
            d === 0
              ? "bg-green-50 text-green-700"
              : d <= 7
              ? "bg-amber-50 text-amber-700"
              : d <= 30
              ? "bg-orange-50 text-orange-700"
              : "bg-red-50 text-red-700"
          )}
        >
          <Clock className="h-2.5 w-2.5" />
          {d}d
        </span>
      );
    },
    csv: (u) => {
      const d = getDaysEmpty(u);
      return d === null ? "" : String(d);
    },
    foot: (units) => {
      const days = units.map(getDaysEmpty).filter((d): d is number => d !== null);
      if (days.length === 0) return null;
      const avg = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
      return <span className="tabular-nums">avg {avg}d</span>;
    },
  },
  {
    key: "price",
    label: "Price PCM",
    align: "right",
    sortValue: (u) => priceValue(u),
    cell: (u) => (
      <span className="font-medium tabular-nums text-foreground">{formatPrice(u.min_price_pcm, u.max_price_pcm)}</span>
    ),
    csv: (u) => {
      const { min_price_pcm: min, max_price_pcm: max } = u;
      if (!min && !max) return "";
      if (min && max && min !== max) return `${min}-${max}`;
      return String(max ?? min);
    },
    foot: (units) => {
      const sum = units.reduce((acc, u) => acc + (priceValue(u) ?? 0), 0);
      if (sum === 0) return null;
      return <span className="font-semibold tabular-nums">£{sum.toLocaleString()}</span>;
    },
  },
  {
    key: "deposit",
    label: "Deposit",
    align: "right",
    sortValue: (u) => u.deposit ?? null,
    cell: (u) => (
      <span className="tabular-nums text-foreground-secondary">
        {u.deposit != null ? `£${u.deposit.toLocaleString()}` : "—"}
      </span>
    ),
    csv: (u) => (u.deposit != null ? String(u.deposit) : ""),
  },
  {
    key: "tenant",
    label: "Tenant",
    sortValue: (u) => tenantName(u)?.toLowerCase() ?? null,
    cell: (u) => {
      const name = tenantName(u);
      return name ? (
        <span className="truncate text-foreground">{name}</span>
      ) : (
        <span className="text-foreground-muted">Vacant</span>
      );
    },
    csv: (u) => tenantName(u) ?? "",
  },
  {
    key: "type",
    label: "Type",
    sortValue: (u) => formatUnitType(u).toLowerCase(),
    cell: (u) => <span className="text-foreground-secondary">{formatUnitType(u)}</span>,
    csv: (u) => formatUnitType(u),
  },
  {
    key: "portfolio",
    label: "Portfolio",
    sortValue: (u) => u.property?.portfolio?.name?.toLowerCase() ?? null,
    cell: (u) =>
      u.property?.portfolio ? (
        <span className="inline-flex items-center gap-1.5 text-foreground-secondary">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: u.property.portfolio.color }} />
          <span className="truncate">{u.property.portfolio.name}</span>
        </span>
      ) : (
        <span className="text-foreground-muted">—</span>
      ),
    csv: (u) => u.property?.portfolio?.name ?? "",
  },
];

/* Progressive disclosure on small screens: the essentials (Property, Unit,
   Status, Available, Price) always show; the rest appear as the viewport
   widens. CSV export always includes every column regardless of what's shown. */
const HIDE_CLASS: Record<string, string> = {
  tenant: "hidden sm:table-cell",
  vacant: "hidden md:table-cell",
  deposit: "hidden lg:table-cell",
  type: "hidden lg:table-cell",
  portfolio: "hidden xl:table-cell",
};

/* ------------------------------------------------------------------ export */

function csvEscape(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function downloadCsv(units: Unit[]) {
  const header = COLUMNS.map((c) => c.label);
  const rows = units.map((u) => COLUMNS.map((c) => c.csv(u)));
  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
  // Prepend a UTF-8 BOM so Excel reads £ signs correctly.
  const body = "﻿" + csv;
  const blob = new Blob([body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const today = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `properties-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ view */

type SortState = { key: string; dir: "asc" | "desc" } | null;

interface UnitsSheetViewProps {
  units: Unit[];
  onUnitClick: (unitId: string) => void;
  onStatusChanged: (change: UnitStatusChange) => void;
}

export function UnitsSheetView({ units, onUnitClick, onStatusChanged }: UnitsSheetViewProps) {
  const [sort, setSort] = useState<SortState>({ key: "available", dir: "asc" });
  const [compact, setCompact] = useState(true);

  const sorted = useMemo(() => {
    if (!sort) return units;
    const col = COLUMNS.find((c) => c.key === sort.key);
    if (!col) return units;
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...units].sort((a, b) => {
      const av = col.sortValue(a);
      const bv = col.sortValue(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1; // nulls always last
      if (bv === null) return -1;
      const cmp =
        typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return cmp * dir;
    });
  }, [units, sort]);

  const cycleSort = (key: string) =>
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null; // third click clears back to default order
    });

  const ctx: CellCtx = { onStatusChanged };
  const cellPad = compact ? "px-3 py-1.5" : "px-3 py-3";

  if (units.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-card py-16 text-center">
        <Warehouse className="mx-auto mb-3 h-10 w-10 text-foreground-muted" strokeWidth={1.5} />
        <p className="mb-1 text-sm font-medium text-foreground">No units found</p>
        <p className="text-xs text-foreground-secondary">Try adjusting your filters or add a new property</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setCompact((c) => !c)}
          title={compact ? "Comfortable rows" : "Compact rows"}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-card px-2.5 text-xs font-medium text-foreground-secondary transition-colors hover:bg-surface-inset hover:text-foreground"
        >
          {compact ? <Rows3 className="h-3.5 w-3.5" /> : <Rows2 className="h-3.5 w-3.5" />}
          {compact ? "Compact" : "Comfortable"}
        </button>
        <button
          type="button"
          onClick={() => downloadCsv(sorted)}
          title="Export the filtered units to a spreadsheet (CSV)"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-card px-2.5 text-xs font-medium text-foreground-secondary transition-colors hover:bg-surface-inset hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      {/* Sheet */}
      <div className="overflow-auto rounded-xl border border-border bg-surface-card max-h-[calc(100vh-260px)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {COLUMNS.map((col, i) => {
                const active = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => cycleSort(col.key)}
                    className={cn(
                      "sticky top-0 z-20 cursor-pointer select-none whitespace-nowrap border-b border-border bg-surface-inset px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted transition-colors hover:text-foreground",
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                      HIDE_CLASS[col.key],
                      i === 0 && "left-0 z-30"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        col.align === "right" && "flex-row-reverse"
                      )}
                    >
                      {col.label}
                      {active ? (
                        sort!.dir === "asc" ? (
                          <ArrowUp className="h-3 w-3 text-brand" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-brand" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sorted.map((u) => (
              <tr
                key={u.id}
                onClick={() => onUnitClick(u.id)}
                className="group cursor-pointer border-b border-border/60 hover:bg-surface-inset/60"
              >
                {COLUMNS.map((col, i) => (
                  <td
                    key={col.key}
                    onClick={col.key === "status" ? (e) => e.stopPropagation() : undefined}
                    className={cn(
                      cellPad,
                      "align-middle whitespace-nowrap",
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                      HIDE_CLASS[col.key],
                      i === 0 &&
                        "sticky left-0 z-10 max-w-[150px] bg-surface-card group-hover:bg-surface-inset sm:max-w-[220px]"
                    )}
                  >
                    {col.cell(u, ctx)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              {COLUMNS.map((col, i) => (
                <td
                  key={col.key}
                  className={cn(
                    "sticky bottom-0 z-20 whitespace-nowrap border-t border-border bg-surface-inset px-3 py-2 text-xs font-medium text-foreground-secondary",
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                    HIDE_CLASS[col.key],
                    i === 0 && "left-0 z-30"
                  )}
                >
                  {col.foot?.(sorted) ?? null}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

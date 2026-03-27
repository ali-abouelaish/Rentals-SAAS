"use client";

import { Search, X } from "lucide-react";
import type { PmTenantFilters, EmploymentStatus } from "../domain/types";
import { EMPLOYMENT_STATUS_LABELS } from "../domain/types";

interface TenantFilterBarProps {
  filters: PmTenantFilters;
  onChange: (f: PmTenantFilters) => void;
  total: number;
}

const inputCls =
  "h-9 rounded-lg border border-border bg-surface-card px-3 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

const selectCls =
  "h-9 rounded-lg border border-border bg-surface-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

export function TenantFilterBar({ filters, onChange, total }: TenantFilterBarProps) {
  const update = (partial: Partial<PmTenantFilters>) =>
    onChange({ ...filters, ...partial });

  const hasActive =
    filters.search ||
    filters.nationality ||
    filters.employment_status ||
    filters.rtr_status;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search name, email, phone…"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className={`${inputCls} pl-8 w-56`}
        />
      </div>

      {/* Nationality */}
      <input
        type="text"
        placeholder="Nationality…"
        value={filters.nationality}
        onChange={(e) => update({ nationality: e.target.value })}
        className={`${inputCls} w-36`}
      />

      {/* Employment status */}
      <select
        value={filters.employment_status}
        onChange={(e) =>
          update({ employment_status: e.target.value as EmploymentStatus | "" })
        }
        className={`${selectCls} w-44`}
      >
        <option value="">Employment status</option>
        {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>

      {/* Right to Rent status */}
      <select
        value={filters.rtr_status}
        onChange={(e) =>
          update({ rtr_status: e.target.value as PmTenantFilters["rtr_status"] })
        }
        className={`${selectCls} w-40`}
      >
        <option value="">Right to Rent</option>
        <option value="verified">Verified</option>
        <option value="unverified">Unverified</option>
        <option value="expired">Expired</option>
      </select>

      {/* Clear */}
      {hasActive && (
        <button
          type="button"
          onClick={() =>
            onChange({ search: "", nationality: "", employment_status: "", rtr_status: "" })
          }
          className="flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-surface-inset transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}

      <span className="ml-auto text-xs text-foreground-muted">{total} tenant{total !== 1 ? "s" : ""}</span>
    </div>
  );
}

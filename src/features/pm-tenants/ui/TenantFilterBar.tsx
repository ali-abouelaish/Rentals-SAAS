"use client";

import { Search } from "lucide-react";
import type { PmTenantFilters } from "../domain/types";

interface TenantFilterBarProps {
  filters: PmTenantFilters;
  onChange: (f: PmTenantFilters) => void;
  total: number;
}

const inputCls =
  "h-11 md:h-9 rounded-lg border border-border bg-surface-card px-3 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

export function TenantFilterBar({ filters, onChange, total }: TenantFilterBarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:w-auto">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search name, email, phone…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className={`${inputCls} pl-8 w-full sm:w-56`}
        />
      </div>

      <span className="ml-auto text-xs text-foreground-muted">{total} tenant{total !== 1 ? "s" : ""}</span>
    </div>
  );
}

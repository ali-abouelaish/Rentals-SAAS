"use client";

import { Search, X } from "lucide-react";
import { CONTRACT_STATUS_CONFIG, type ContractFilters, type ContractStatus } from "../domain/types";
import type { Portfolio } from "@/features/properties/domain/types";

interface ContractFilterBarProps {
  filters: ContractFilters;
  onChange: (f: ContractFilters) => void;
  portfolios: Portfolio[];
  total: number;
}

const inputCls =
  "h-9 rounded-lg border border-border bg-surface-card px-3 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const selectCls =
  "h-9 rounded-lg border border-border bg-surface-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

export function ContractFilterBar({ filters, onChange, portfolios, total }: ContractFilterBarProps) {
  const update = (partial: Partial<ContractFilters>) => onChange({ ...filters, ...partial });

  const hasActive = filters.search || filters.portfolioId || filters.status || filters.depositProtected;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search tenant, property…"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className={`${inputCls} pl-8 w-52`}
        />
      </div>

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

      <select
        value={filters.status}
        onChange={(e) => update({ status: e.target.value as ContractStatus | "" })}
        className={`${selectCls} w-40`}
      >
        <option value="">All statuses</option>
        {Object.entries(CONTRACT_STATUS_CONFIG).map(([v, cfg]) => (
          <option key={v} value={v}>{cfg.label}</option>
        ))}
      </select>

      <select
        value={filters.depositProtected}
        onChange={(e) => update({ depositProtected: e.target.value as ContractFilters["depositProtected"] })}
        className={`${selectCls} w-44`}
      >
        <option value="">Deposit: any</option>
        <option value="yes">Deposit protected</option>
        <option value="no">Not protected</option>
      </select>

      {hasActive && (
        <button
          type="button"
          onClick={() => onChange({ search: "", portfolioId: "", status: "", depositProtected: "" })}
          className="flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-surface-inset transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}

      <span className="ml-auto text-xs text-foreground-muted">{total} contract{total !== 1 ? "s" : ""}</span>
    </div>
  );
}

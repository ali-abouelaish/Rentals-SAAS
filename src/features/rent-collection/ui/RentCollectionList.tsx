"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { RentCollectionRow } from "./RentCollectionRow";
import type { RentCollectionRow as Row } from "../data/queries";

type FilterKey = "all" | "owed" | "on_track" | "this_month_unpaid";
type SortKey = "most_owed" | "tenant_az" | "property_az" | "last_paid";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "owed", label: "Owed" },
  { key: "on_track", label: "On track" },
  { key: "this_month_unpaid", label: "Unpaid this month" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "most_owed", label: "Most owed" },
  { key: "tenant_az", label: "Tenant A–Z" },
  { key: "property_az", label: "Property A–Z" },
  { key: "last_paid", label: "Last paid" },
];

export function RentCollectionList({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("most_owed");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows;

    if (filter === "owed") out = out.filter((r) => r.arrears > 0);
    else if (filter === "on_track") out = out.filter((r) => r.arrears === 0);
    else if (filter === "this_month_unpaid") out = out.filter((r) => !r.currentMonthPaid);

    if (q) {
      out = out.filter(
        (r) =>
          r.tenant.name.toLowerCase().includes(q) ||
          r.property.name.toLowerCase().includes(q) ||
          (r.unit.roomNumber ?? "").toLowerCase().includes(q)
      );
    }

    out = [...out].sort((a, b) => {
      switch (sort) {
        case "most_owed":
          return b.arrears - a.arrears || a.tenant.name.localeCompare(b.tenant.name);
        case "tenant_az":
          return a.tenant.name.localeCompare(b.tenant.name);
        case "property_az":
          return (
            a.property.name.localeCompare(b.property.name) ||
            a.tenant.name.localeCompare(b.tenant.name)
          );
        case "last_paid": {
          const aT = a.lastPaidAt ? Date.parse(a.lastPaidAt) : 0;
          const bT = b.lastPaidAt ? Date.parse(b.lastPaidAt) : 0;
          return bT - aT;
        }
      }
    });

    return out;
  }, [rows, filter, sort, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                filter === f.key
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border bg-surface-card text-foreground-secondary hover:bg-surface-inset"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenant, property…"
              className="h-8 w-56 rounded-lg border border-border bg-surface-card pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>
          <label className="sr-only" htmlFor="rc-sort">Sort</label>
          <select
            id="rc-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-8 rounded-lg border border-border bg-surface-card px-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <p className="text-sm font-medium text-foreground">No tenancies match these filters</p>
          <p className="text-xs text-foreground-secondary mt-1">
            Try clearing the search or switching to All.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => (
            <RentCollectionRow key={row.contractId} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

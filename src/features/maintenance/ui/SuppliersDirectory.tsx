"use client";

import { useMemo, useState } from "react";
import { HardHat, Mail, Phone, Search, Trash2, User, Wrench } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { deleteSupplier } from "../actions/suppliers";
import { JOB_CATEGORY_LABELS } from "../domain/types";
import type { JobCategory, MaintenanceJob, MaintenanceSupplier } from "../domain/types";

interface SuppliersDirectoryProps {
  suppliers: MaintenanceSupplier[];
  jobs: MaintenanceJob[];
  onEdit: (supplier: MaintenanceSupplier) => void;
  onAdd: () => void;
  onDeleted: (supplierId: string) => void;
}

export function SuppliersDirectory({
  suppliers,
  jobs,
  onEdit,
  onAdd,
  onDeleted,
}: SuppliersDirectoryProps) {
  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState<JobCategory | "all">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Active (not resolved/closed) job count per supplier, for the "Jobs" column.
  const activeJobCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      if (!job.supplier_id || ["resolved", "closed"].includes(job.status)) continue;
      counts.set(job.supplier_id, (counts.get(job.supplier_id) ?? 0) + 1);
    }
    return counts;
  }, [jobs]);

  const tradesInUse = useMemo(
    () => Array.from(new Set(suppliers.map((s) => s.trade))),
    [suppliers]
  );

  const filtered = useMemo(() => {
    let result = suppliers;
    if (tradeFilter !== "all") {
      result = result.filter((s) => s.trade === tradeFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.contact_name ?? "").toLowerCase().includes(q) ||
          (s.email ?? "").toLowerCase().includes(q) ||
          (s.phone ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [suppliers, tradeFilter, search]);

  async function handleDelete(supplier: MaintenanceSupplier) {
    const activeCount = activeJobCounts.get(supplier.id) ?? 0;
    const warning =
      activeCount > 0
        ? ` They are assigned to ${activeCount} active ${activeCount === 1 ? "job" : "jobs"}, which will become unassigned.`
        : "";
    if (!confirm(`Remove "${supplier.name}" from your supplier directory?${warning}`)) return;
    setDeletingId(supplier.id);
    try {
      const result = await deleteSupplier(supplier.id);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Supplier removed");
        onDeleted(supplier.id);
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            title="Search by company, contact, email, or phone"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-surface-card text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
        </div>

        {tradesInUse.length > 1 && (
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setTradeFilter("all")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tradeFilter === "all"
                  ? "bg-brand text-brand-fg shadow-sm"
                  : "text-foreground-secondary hover:bg-surface-inset"
              )}
            >
              All trades
            </button>
            {tradesInUse.map((trade) => (
              <button
                key={trade}
                onClick={() => setTradeFilter(trade)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  tradeFilter === trade
                    ? "bg-brand text-brand-fg shadow-sm"
                    : "text-foreground-secondary hover:bg-surface-inset"
                )}
              >
                {JOB_CATEGORY_LABELS[trade]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-bento bg-surface-card shadow-bento overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold text-foreground-muted uppercase tracking-wider border-b border-border">
                <th className="text-left pb-3 pt-4 pl-4 pr-4">Supplier</th>
                <th className="text-left pb-3 pt-4 pr-4 hidden md:table-cell">Trade</th>
                <th className="text-left pb-3 pt-4 pr-4 hidden lg:table-cell">Contact</th>
                <th className="text-left pb-3 pt-4 pr-4 hidden sm:table-cell">Phone / Email</th>
                <th className="text-right pb-3 pt-4 pr-4" title="Jobs currently assigned to this supplier (excludes resolved and closed)">
                  Active Jobs
                </th>
                <th className="pb-3 pt-4 pr-4 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((supplier) => {
                const activeCount = activeJobCounts.get(supplier.id) ?? 0;
                return (
                  <tr
                    key={supplier.id}
                    onClick={() => onEdit(supplier)}
                    className="group cursor-pointer hover:bg-surface-inset transition-colors"
                    title="Click to view or edit this supplier"
                  >
                    <td className="py-3 pl-4 pr-4">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{supplier.name}</p>
                      {supplier.notes && (
                        <p className="text-xs text-foreground-muted line-clamp-1 mt-0.5">{supplier.notes}</p>
                      )}
                    </td>
                    <td className="py-3 pr-4 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-inset px-2.5 py-0.5 text-[11px] font-semibold text-foreground-secondary">
                        <Wrench size={10} />
                        {JOB_CATEGORY_LABELS[supplier.trade]}
                      </span>
                    </td>
                    <td className="py-3 pr-4 hidden lg:table-cell">
                      {supplier.contact_name ? (
                        <span className="text-xs text-foreground-secondary flex items-center gap-1">
                          <User size={11} />
                          {supplier.contact_name}
                        </span>
                      ) : (
                        <span className="text-xs text-foreground-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 hidden sm:table-cell">
                      <div className="space-y-0.5">
                        {supplier.phone && (
                          <p className="text-xs text-foreground-secondary flex items-center gap-1">
                            <Phone size={11} className="shrink-0" />
                            {supplier.phone}
                          </p>
                        )}
                        {supplier.email && (
                          <p className="text-xs text-foreground-secondary flex items-center gap-1">
                            <Mail size={11} className="shrink-0" />
                            {supplier.email}
                          </p>
                        )}
                        {!supplier.phone && !supplier.email && (
                          <span className="text-xs text-foreground-muted">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {activeCount > 0 ? (
                        <span className="inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 px-2 min-w-[24px] h-5 text-[11px] font-semibold tabular-nums">
                          {activeCount}
                        </span>
                      ) : (
                        <span className="text-xs text-foreground-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(supplier);
                        }}
                        disabled={deletingId === supplier.id}
                        title="Remove this supplier from the directory"
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-all disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <HardHat size={32} className="mx-auto text-foreground-muted mb-3" strokeWidth={1.5} />
              <p className="text-sm text-foreground-secondary">
                {search || tradeFilter !== "all"
                  ? "No suppliers match your filters"
                  : "No preferred suppliers yet"}
              </p>
              {!search && tradeFilter === "all" && (
                <button
                  onClick={onAdd}
                  className="text-brand text-sm font-medium hover:underline mt-1"
                >
                  Add your first supplier
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {suppliers.length > 0 && (
        <p className="text-xs text-foreground-muted">
          Suppliers in this directory can be assigned to jobs when raising them or from the job drawer.
        </p>
      )}
    </div>
  );
}

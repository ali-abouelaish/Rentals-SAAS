"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, X, Loader2, Building2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { linkEvaluationToProperty } from "../actions/evaluations";

interface Property {
  id: string;
  name: string;
  address_line_1: string;
  area: string | null;
  property_type: string;
  portfolio?: { name: string; color: string } | null;
}

interface LinkPropertyModalProps {
  evaluationId: string;
  properties: Property[];
  onClose: () => void;
}

export function LinkPropertyModal({
  evaluationId,
  properties,
  onClose,
}: LinkPropertyModalProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = properties.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.address_line_1.toLowerCase().includes(search.toLowerCase()) ||
      (p.area ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirm = () => {
    if (!selected) return;
    startTransition(async () => {
      try {
        await linkEvaluationToProperty(evaluationId, selected);
        toast.success("Property linked. Status updated to Taken On.");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to link property.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Link to a Property</h2>
            <p className="text-xs text-foreground-secondary mt-0.5">
              Select the live property this evaluation is for
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-foreground-secondary hover:text-foreground hover:bg-surface-raised transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-secondary"
            />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search properties…"
              className="h-9 w-full rounded-lg border border-border bg-surface-raised pl-9 pr-3 text-[13px] text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>

        {/* Property list */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="py-10 text-center">
              <Building2 className="h-8 w-8 text-foreground-secondary mx-auto mb-2" />
              <p className="text-sm text-foreground-secondary">No properties found</p>
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id === selected ? null : p.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-raised",
                  selected === p.id && "bg-brand/5 border-l-2 border-l-brand"
                )}
              >
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-white"
                  style={{
                    backgroundColor: p.portfolio?.color ?? "#6366f1",
                  }}
                >
                  {p.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-[11px] text-foreground-secondary truncate">
                    {p.address_line_1}
                    {p.area && ` · ${p.area}`}
                    {p.portfolio && ` · ${p.portfolio.name}`}
                  </p>
                </div>
                {selected === p.id && (
                  <CheckCircle2 size={18} className="text-brand shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-surface-raised px-4 py-2 text-[13px] font-medium text-foreground hover:bg-border transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selected || isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-[13px] font-semibold text-brand-fg shadow-glow hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Confirm Link
          </button>
        </div>
      </div>
    </div>
  );
}

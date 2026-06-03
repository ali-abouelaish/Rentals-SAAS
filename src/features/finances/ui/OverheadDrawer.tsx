"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  overheadSchema,
  OVERHEAD_CATEGORY_LABELS,
  type BusinessOverhead,
  type OverheadFormValues,
} from "../domain/overheads";
import { createOverhead, updateOverhead } from "../actions/overheads";

type Props = {
  open: boolean;
  editing: BusinessOverhead | null;
  onClose: () => void;
  onSuccess: () => void;
};

const COST_MODES = [
  { value: "recurring" as const, label: "Recurring", desc: "Posts every month" },
  { value: "one_off" as const, label: "One-off", desc: "Single charge" },
  { value: "amortised" as const, label: "Amortised", desc: "Spread over months" },
];

export function OverheadDrawer({ open, editing, onClose, onSuccess }: Props) {
  const isEdit = !!editing;
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<OverheadFormValues>({
    resolver: zodResolver(overheadSchema),
    defaultValues: defaults(editing),
  });

  useEffect(() => {
    reset(defaults(editing));
  }, [editing, reset]);

  const costMode = watch("cost_mode");

  async function onSubmit(values: OverheadFormValues) {
    setLoading(true);
    try {
      const result = isEdit
        ? await updateOverhead(editing!.id, values)
        : await createOverhead(values);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(isEdit ? "Overhead updated" : "Overhead added");
        onSuccess();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <aside className="relative z-10 w-full max-w-md bg-surface-card shadow-xl border-l border-border h-full overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-surface-card">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? "Edit overhead" : "Add overhead"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-inset text-foreground-muted"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              {...register("category")}
              className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {Object.entries(OVERHEAD_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              {...register("label")}
              type="text"
              placeholder="e.g. Xero subscription"
              className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
            />
            {errors.label && (
              <p className="text-xs text-red-600 mt-1">{errors.label.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Amount (£) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-muted">£</span>
              <input
                {...register("amount_pounds")}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full rounded-lg border border-border bg-surface-inset pl-7 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            {errors.amount_pounds && (
              <p className="text-xs text-red-600 mt-1">{errors.amount_pounds.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Vendor</label>
            <input
              {...register("vendor")}
              type="text"
              placeholder="Optional"
              className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Cost mode <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {COST_MODES.map((m) => (
                <label
                  key={m.value}
                  className={cn(
                    "flex flex-col items-center p-3 rounded-xl border cursor-pointer transition-all text-center",
                    costMode === m.value
                      ? "border-brand bg-brand-subtle"
                      : "border-border hover:bg-surface-inset"
                  )}
                >
                  <input
                    {...register("cost_mode")}
                    type="radio"
                    value={m.value}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      costMode === m.value ? "text-brand" : "text-foreground"
                    )}
                  >
                    {m.label}
                  </span>
                  <span className="text-[10px] text-foreground-muted">{m.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {costMode === "recurring" && (
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Recurrence day (1–31)
              </label>
              <input
                {...register("recurrence_day")}
                type="number"
                min="1"
                max="31"
                placeholder="1"
                className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
          )}

          {costMode === "amortised" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Spread over (months)
                </label>
                <input
                  {...register("amortise_months")}
                  type="number"
                  min="1"
                  placeholder="12"
                  className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Amortise from
                </label>
                <input
                  {...register("amortise_start_date")}
                  type="date"
                  className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Date incurred <span className="text-red-500">*</span>
            </label>
            <input
              {...register("date_incurred")}
              type="date"
              className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
            />
            {errors.date_incurred && (
              <p className="text-xs text-red-600 mt-1">{errors.date_incurred.message}</p>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              {...register("is_active")}
              type="checkbox"
              className="rounded border-border text-brand focus:ring-brand"
            />
            <span className="text-foreground">Active (recurring overheads will keep posting)</span>
          </label>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Notes</label>
            <textarea
              {...register("notes")}
              rows={2}
              placeholder="Optional"
              className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" size="md" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="md" disabled={loading} className="flex-1">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? "Save changes" : "Add overhead"}
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function defaults(o: BusinessOverhead | null): OverheadFormValues {
  return {
    category: (o?.category ?? "software") as OverheadFormValues["category"],
    label: o?.label ?? "",
    amount_pounds: o ? o.amount / 100 : ("" as unknown as number),
    vendor: o?.vendor ?? "",
    cost_mode: (o?.cost_mode ?? "recurring") as OverheadFormValues["cost_mode"],
    recurrence_day: o?.recurrence_day ?? ("" as unknown as number),
    amortise_months: o?.amortise_months ?? ("" as unknown as number),
    amortise_start_date: o?.amortise_start_date ?? "",
    date_incurred: o?.date_incurred ?? new Date().toISOString().slice(0, 10),
    is_active: o?.is_active ?? true,
    notes: o?.notes ?? "",
  };
}

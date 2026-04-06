"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { createPropertyCost, updatePropertyCost } from "../actions";
import { COST_TYPE_LABELS } from "../domain/types";
import type { PropertyCost, CostType, CostMode } from "../domain/types";

const schema = z.object({
  cost_type: z.enum([
    "council_tax", "bills", "cleaning", "maintenance", "insurance",
    "owner_rent", "agency_fee", "furniture", "other",
  ] as const),
  cost_label: z.string().optional(),
  amount_pounds: z.coerce.number().positive("Must be greater than £0"),
  cost_mode: z.enum(["recurring", "one_off", "amortised"] as const),
  recurrence_day: z.coerce.number().int().min(1).max(31).optional().or(z.literal("")),
  amortise_months: z.coerce.number().int().positive().optional().or(z.literal("")),
  amortise_start_date: z.string().optional(),
  purchase_date: z.string().optional(),
  date_incurred: z.string().min(1, "Required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CostModalProps {
  propertyId: string;
  unitId?: string | null;
  editingCost?: PropertyCost | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CostModal({ propertyId, editingCost, onClose, onSuccess }: CostModalProps) {
  const isEdit = !!editingCost;
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cost_type: (editingCost?.cost_type as CostType) ?? "other",
      cost_label: editingCost?.cost_label ?? "",
      amount_pounds: editingCost ? editingCost.amount / 100 : undefined,
      cost_mode: (editingCost?.cost_mode as CostMode) ?? "recurring",
      recurrence_day: editingCost?.recurrence_day ?? "",
      amortise_months: editingCost?.amortise_months ?? "",
      amortise_start_date: editingCost?.amortise_start_date ?? "",
      purchase_date: editingCost?.purchase_date ?? "",
      date_incurred: editingCost?.date_incurred ?? new Date().toISOString().split("T")[0],
      notes: editingCost?.notes ?? "",
    },
  });

  const costMode = watch("cost_mode");
  const costType = watch("cost_type");

  useEffect(() => {
    if (!editingCost) reset();
  }, [editingCost, reset]);

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const payload = {
        property_id: propertyId,
        unit_id: null,
        cost_type: values.cost_type,
        cost_label: values.cost_label || null,
        amount_pounds: values.amount_pounds,
        cost_mode: values.cost_mode,
        recurrence_day: values.recurrence_day ? Number(values.recurrence_day) : null,
        amortise_months: values.amortise_months ? Number(values.amortise_months) : null,
        amortise_start_date: values.amortise_start_date || null,
        purchase_date: values.purchase_date || null,
        date_incurred: values.date_incurred,
        notes: values.notes || null,
      };

      const result = isEdit
        ? await updatePropertyCost(editingCost!.id, payload)
        : await createPropertyCost(payload);

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(isEdit ? "Cost updated" : "Cost added");
        onSuccess();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-surface-card shadow-xl border border-border max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? "Edit Cost" : "Add Cost"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-inset text-foreground-muted transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

          {/* Cost Type */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Cost Type <span className="text-red-500">*</span>
            </label>
            <select
              {...register("cost_type")}
              className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {Object.entries(COST_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Custom label — required for "other", optional for others */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Label {costType === "other" && <span className="text-red-500">*</span>}
            </label>
            <input
              {...register("cost_label")}
              type="text"
              placeholder={
                costType === "other"
                  ? "Describe this cost"
                  : "Optional custom label"
              }
              className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          {/* Amount */}
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

          {/* Cost Mode */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Cost Mode <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "recurring" as const, label: "Recurring", desc: "Monthly" },
                { value: "one_off" as const, label: "One-off", desc: "Single" },
                { value: "amortised" as const, label: "Amortised", desc: "Spread out" },
              ]).map((m) => (
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
                  <span className={cn("text-xs font-semibold", costMode === m.value ? "text-brand" : "text-foreground")}>
                    {m.label}
                  </span>
                  <span className="text-[10px] text-foreground-muted">{m.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Recurring-specific */}
          {costMode === "recurring" && (
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Recurrence Day (1–31)
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

          {/* Amortised-specific */}
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
                  placeholder="24"
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

          {/* Date incurred */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Date Incurred <span className="text-red-500">*</span>
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

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Notes</label>
            <textarea
              {...register("notes")}
              rows={2}
              placeholder="Optional notes..."
              className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-brand resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-surface-inset transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-brand-fg hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {isEdit ? "Save changes" : "Add cost"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

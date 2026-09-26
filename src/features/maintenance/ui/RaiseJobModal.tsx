"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { createMaintenanceJob } from "../actions";
import { JOB_CATEGORY_LABELS, JOB_PRIORITY_LABELS } from "../domain/types";
import type { JobCategory, JobPriority, MaintenanceSupplier } from "../domain/types";

// ──────────────────────────────────────────────────────────
// Schema
// ──────────────────────────────────────────────────────────

const schema = z.object({
  property_id: z.string().min(1, "Property is required"),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  category: z.enum(["plumbing", "electrical", "structural", "appliance", "pest_control", "cleaning", "decoration", "gas_heating", "fire_safety", "inspection", "other"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  reported_by: z.string().optional(),
  supplier_id: z.string().optional(),
  scheduled_date: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ──────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────

interface RaiseJobModalProps {
  properties: { id: string; name: string }[];
  suppliers: MaintenanceSupplier[];
  /** Reference this work order will get — previewed, not reserved. The DB
   *  trigger allocates the real one on insert. */
  nextReference: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function RaiseJobModal({
  properties,
  suppliers,
  nextReference,
  onClose,
  onSuccess,
}: RaiseJobModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: "other",
      priority: "medium",
    },
  });

  const selectedPropertyId = watch("property_id") ?? "";
  const selectedSupplierId = watch("supplier_id") ?? "";

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const supplier = values.supplier_id
        ? suppliers.find((s) => s.id === values.supplier_id) ?? null
        : null;
      const result = await createMaintenanceJob({
        property_id: values.property_id,
        title: values.title,
        description: values.description || null,
        category: values.category as JobCategory,
        priority: values.priority as JobPriority,
        reported_by: values.reported_by || null,
        assigned_to: supplier?.name ?? null,
        supplier_id: supplier?.id ?? null,
        scheduled_date: values.scheduled_date || null,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(
          result?.reference ? `Work order ${result.reference} created` : "Work order created"
        );
        onSuccess();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New work order"
        className="relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-bento bg-surface-card shadow-2xl sm:max-h-[85dvh] sm:rounded-bento"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">New Work Order</h2>
              {nextReference && (
                <span
                  className="rounded-md bg-surface-inset px-1.5 py-0.5 text-[11px] font-mono tabular-nums text-foreground-secondary"
                  title="The reference this work order will be given when you save"
                >
                  {nextReference}
                </span>
              )}
            </div>
            <p className="text-xs text-foreground-muted mt-0.5">
              Standalone — no tenant ticket required.
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-inset hover:text-foreground sm:h-8 sm:w-8"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">

          {/* Property */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Property <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              value={selectedPropertyId}
              onChange={(val) => setValue("property_id", val, { shouldValidate: true })}
              options={properties.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Select property…"
              error={!!errors.property_id}
            />
            {errors.property_id && (
              <p className="text-xs text-red-600 mt-1">{errors.property_id.message}</p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Work Order Title <span className="text-red-500">*</span>
            </label>
            <input
              {...register("title")}
              placeholder="e.g. Blocked drain in bathroom"
              className={cn(
                "w-full rounded-xl border bg-surface-card px-3 py-2.5 text-base sm:py-2 sm:text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50",
                errors.title ? "border-red-400" : "border-border"
              )}
            />
            {errors.title && (
              <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Category + Priority (side by side) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
              <select
                {...register("category")}
                className="w-full rounded-xl border border-border bg-surface-card px-3 py-2.5 text-base sm:py-2 sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
              >
                {(Object.keys(JOB_CATEGORY_LABELS) as JobCategory[]).map((k) => (
                  <option key={k} value={k}>{JOB_CATEGORY_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Priority</label>
              <select
                {...register("priority")}
                className="w-full rounded-xl border border-border bg-surface-card px-3 py-2.5 text-base sm:py-2 sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
              >
                {(Object.keys(JOB_PRIORITY_LABELS) as JobPriority[]).map((k) => (
                  <option key={k} value={k}>{JOB_PRIORITY_LABELS[k]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
            <textarea
              {...register("description")}
              rows={3}
              placeholder="Describe the issue in detail…"
              className="w-full rounded-xl border border-border bg-surface-card px-3 py-2.5 text-base sm:py-2 sm:text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50 resize-none"
            />
          </div>

          {/* Reported by + Assigned supplier */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-0.5">Reported by</label>
              <p className="text-[11px] text-foreground-muted mb-1.5">
                Optional. Tenant name or &lsquo;Staff&rsquo;.
              </p>
              <input
                {...register("reported_by")}
                placeholder="Tenant name or 'Staff'"
                className="w-full rounded-xl border border-border bg-surface-card px-3 py-2.5 text-base sm:py-2 sm:text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-0.5">Assign supplier</label>
              <p className="text-[11px] text-foreground-muted mb-1.5">
                Optional. Pick from your preferred suppliers.
              </p>
              <SearchableSelect
                value={selectedSupplierId}
                onChange={(val) => setValue("supplier_id", val, { shouldValidate: true })}
                options={[
                  { value: "", label: "Unassigned" },
                  ...suppliers.map((s) => ({
                    value: s.id,
                    label: s.name,
                    sublabel: JOB_CATEGORY_LABELS[s.trade],
                  })),
                ]}
                placeholder="Unassigned"
              />
              {errors.supplier_id && (
                <p className="text-xs text-red-600 mt-1">{errors.supplier_id.message}</p>
              )}
            </div>
          </div>

          {/* Scheduled date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Scheduled Date</label>
            <input
              type="date"
              {...register("scheduled_date")}
              className="w-full rounded-xl border border-border bg-surface-card px-3 py-2.5 text-base sm:py-2 sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 w-full rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-inset sm:min-h-0 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 w-full rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-brand-fg transition-opacity hover:opacity-90 disabled:opacity-60 sm:min-h-0 sm:w-auto"
            >
              {submitting ? "Creating…" : "Create Work Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

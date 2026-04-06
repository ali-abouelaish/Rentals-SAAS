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
import type { JobCategory, JobPriority } from "../domain/types";

// ──────────────────────────────────────────────────────────
// Schema
// ──────────────────────────────────────────────────────────

const schema = z.object({
  property_id: z.string().min(1, "Property is required"),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  category: z.enum(["plumbing", "electrical", "structural", "appliance", "pest_control", "cleaning", "decoration", "other"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  reported_by: z.string().optional(),
  assigned_to: z.string().optional(),
  scheduled_date: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ──────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────

interface RaiseJobModalProps {
  properties: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

export function RaiseJobModal({ properties, onClose, onSuccess }: RaiseJobModalProps) {
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

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const result = await createMaintenanceJob({
        property_id: values.property_id,
        title: values.title,
        description: values.description || null,
        category: values.category as JobCategory,
        priority: values.priority as JobPriority,
        reported_by: values.reported_by || null,
        assigned_to: values.assigned_to || null,
        scheduled_date: values.scheduled_date || null,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Job raised");
        onSuccess();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface-card rounded-bento shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Raise New Job</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-inset transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">

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
              Job Title <span className="text-red-500">*</span>
            </label>
            <input
              {...register("title")}
              placeholder="e.g. Blocked drain in bathroom"
              className={cn(
                "w-full rounded-xl border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50",
                errors.title ? "border-red-400" : "border-border"
              )}
            />
            {errors.title && (
              <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Category + Priority (side by side) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
              <select
                {...register("category")}
                className="w-full rounded-xl border border-border bg-surface-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
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
                className="w-full rounded-xl border border-border bg-surface-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
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
              className="w-full rounded-xl border border-border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50 resize-none"
            />
          </div>

          {/* Reported by + Assigned to */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Reported by</label>
              <input
                {...register("reported_by")}
                placeholder="Tenant name or 'Staff'"
                className="w-full rounded-xl border border-border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Assigned to</label>
              <input
                {...register("assigned_to")}
                placeholder="Contractor or engineer"
                className="w-full rounded-xl border border-border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>
          </div>

          {/* Scheduled date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Scheduled Date</label>
            <input
              type="date"
              {...register("scheduled_date")}
              className="w-full rounded-xl border border-border bg-surface-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-inset transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-brand-fg hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {submitting ? "Raising…" : "Raise Job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

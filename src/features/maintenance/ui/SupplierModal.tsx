"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { createSupplier, updateSupplier } from "../actions/suppliers";
import { JOB_CATEGORY_LABELS } from "../domain/types";
import type { JobCategory, MaintenanceSupplier } from "../domain/types";

// ──────────────────────────────────────────────────────────
// Schema (mirrored server-side in actions/suppliers.ts)
// ──────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Company name is required").max(200, "Max 200 characters"),
  trade: z.enum(["plumbing", "electrical", "structural", "appliance", "pest_control", "cleaning", "decoration", "other"]),
  contact_name: z.string().max(200, "Max 200 characters").optional(),
  phone: z.string().max(50, "Max 50 characters").optional(),
  email: z.string().email("Enter a valid email address").max(255).optional().or(z.literal("")),
  notes: z.string().max(2000, "Max 2000 characters").optional(),
});

type FormValues = z.infer<typeof schema>;

// ──────────────────────────────────────────────────────────
// Field wrapper — label above, hint under label, error below
// ──────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  hint: string;
  required?: boolean;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

function Field({ label, hint, required, error, htmlFor, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground mb-0.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <p className="text-[11px] text-foreground-muted mb-1.5">{hint}</p>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

const inputClass = (hasError: boolean) =>
  cn(
    "w-full rounded-xl border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50",
    hasError ? "border-red-400" : "border-border"
  );

// ──────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────

interface SupplierModalProps {
  /** Pass an existing supplier to edit; omit to create. */
  supplier?: MaintenanceSupplier | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function SupplierModal({ supplier, onClose, onSuccess }: SupplierModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!supplier;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: supplier?.name ?? "",
      trade: supplier?.trade ?? "other",
      contact_name: supplier?.contact_name ?? "",
      phone: supplier?.phone ?? "",
      email: supplier?.email ?? "",
      notes: supplier?.notes ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        trade: values.trade as JobCategory,
        contact_name: values.contact_name || null,
        phone: values.phone || null,
        email: values.email || null,
        notes: values.notes || null,
      };
      const result = isEdit
        ? await updateSupplier(supplier!.id, payload)
        : await createSupplier(payload);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(isEdit ? "Supplier updated" : "Supplier added");
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
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? "Edit Supplier" : "Add Supplier"}
          </h2>
          <button
            onClick={onClose}
            title="Close without saving"
            className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-inset transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <Field
            label="Company name"
            hint="The name shown when assigning jobs. Max 200 characters."
            required
            error={errors.name?.message}
            htmlFor="supplier-name"
          >
            <input
              id="supplier-name"
              {...register("name")}
              placeholder="e.g. AquaFix Plumbing Ltd"
              className={inputClass(!!errors.name)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Trade"
              hint="Main trade they cover."
              error={errors.trade?.message}
              htmlFor="supplier-trade"
            >
              <select
                id="supplier-trade"
                {...register("trade")}
                title="Used to suggest the right supplier for a job's category"
                className={inputClass(!!errors.trade)}
              >
                {(Object.keys(JOB_CATEGORY_LABELS) as JobCategory[]).map((k) => (
                  <option key={k} value={k}>{JOB_CATEGORY_LABELS[k]}</option>
                ))}
              </select>
            </Field>

            <Field
              label="Contact name"
              hint="Optional. Who you usually deal with."
              error={errors.contact_name?.message}
              htmlFor="supplier-contact"
            >
              <input
                id="supplier-contact"
                {...register("contact_name")}
                placeholder="e.g. Dave Smith"
                className={inputClass(!!errors.contact_name)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Phone"
              hint="Optional. Include country code, e.g. +44."
              error={errors.phone?.message}
              htmlFor="supplier-phone"
            >
              <input
                id="supplier-phone"
                type="tel"
                {...register("phone")}
                placeholder="+44 7700 900123"
                className={inputClass(!!errors.phone)}
              />
            </Field>

            <Field
              label="Email"
              hint="Optional. Format: name@company.com."
              error={errors.email?.message}
              htmlFor="supplier-email"
            >
              <input
                id="supplier-email"
                type="email"
                {...register("email")}
                placeholder="dave@aquafix.co.uk"
                className={inputClass(!!errors.email)}
              />
            </Field>
          </div>

          <Field
            label="Notes"
            hint="Optional. Rates, coverage area, account refs. Max 2000 characters."
            error={errors.notes?.message}
            htmlFor="supplier-notes"
          >
            <textarea
              id="supplier-notes"
              {...register("notes")}
              rows={3}
              placeholder="e.g. £80 call-out, covers E1–E14, net 30 payment terms"
              className={cn(inputClass(!!errors.notes), "resize-none")}
            />
          </Field>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              loading={submitting}
              title={isEdit ? "Save changes to this supplier" : "Add this supplier to your directory"}
            >
              {isEdit ? "Save Changes" : "Add Supplier"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

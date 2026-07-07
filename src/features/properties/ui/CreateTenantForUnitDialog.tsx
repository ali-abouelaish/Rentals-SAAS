"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  pmTenantQuickCreateSchema,
  type PmTenantQuickCreateValues,
} from "@/features/pm-tenants/domain/schemas";
import { createPmTenantQuick } from "@/features/pm-tenants/actions/pm-tenants";
import { EMPLOYMENT_STATUS_LABELS } from "@/features/pm-tenants/domain/types";
import type { Unit } from "../domain/types";

/** Minimal tenant option the Tenant tab uses for the picker + linked view. */
export interface CreatedTenantOption {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const selectCls = inputCls;

function FormField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {hint && <p className="text-xs text-foreground-muted">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  unit: Unit;
  /** Called after the tenant is created; the tab performs the unit link. */
  onCreatedAndLinked: (tenant: CreatedTenantOption) => void | Promise<void>;
}

export function CreateTenantForUnitDialog({ open, onClose, unit, onCreatedAndLinked }: Props) {
  const [isPending, startTransition] = useTransition();

  const unitLabel =
    unit.unit_type === "room" && unit.room_number
      ? `Room ${unit.room_number}`
      : unit.unit_type === "studio"
        ? "Studio"
        : "Whole Flat";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PmTenantQuickCreateValues>({
    resolver: zodResolver(pmTenantQuickCreateSchema),
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = (values: PmTenantQuickCreateValues) => {
    startTransition(async () => {
      try {
        const created = (await createPmTenantQuick(values)) as {
          id: string;
          full_name: string | null;
          email: string | null;
          phone: string | null;
        };
        await onCreatedAndLinked({
          id: created.id,
          full_name: created.full_name,
          email: created.email,
          phone: created.phone,
        });
        toast.success("Tenant created and linked");
        reset();
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create tenant");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New tenant — {unit.property?.name} · {unitLabel}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-foreground-secondary -mt-1">
          Everything is optional — create the tenant now and fill in the rest later
          from the Tenants module. They&apos;ll be linked to this unit straight away.
        </p>
        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Full name"
              hint="Optional — add it later if unknown"
              error={errors.full_name?.message}
            >
              <input {...register("full_name")} className={inputCls} />
            </FormField>
            <FormField
              label="Date of birth"
              hint="Use the date picker"
              error={errors.date_of_birth?.message}
            >
              <input type="date" {...register("date_of_birth")} className={inputCls} />
            </FormField>
            <FormField
              label="Email"
              hint="Valid email if provided"
              error={errors.email?.message}
            >
              <input type="email" {...register("email")} className={inputCls} />
            </FormField>
            <FormField
              label="Phone"
              hint="Include country code"
              error={errors.phone?.message}
            >
              <input {...register("phone")} className={inputCls} />
            </FormField>
            <FormField
              label="Nationality"
              hint="Optional"
              error={errors.nationality?.message}
            >
              <input {...register("nationality")} className={inputCls} />
            </FormField>
            <FormField
              label="Employment status"
              hint="Optional"
              error={errors.employment_status?.message}
            >
              <select {...register("employment_status")} className={selectCls}>
                <option value="">Select…</option>
                {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              Create &amp; link tenant
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

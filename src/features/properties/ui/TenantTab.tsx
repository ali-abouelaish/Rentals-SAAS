"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus, User, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { createResident, updateResident } from "../actions/residents";
import { updateUnit } from "../actions/units";
import { residentSchema, type ResidentFormValues } from "../domain/schemas";
import type { Unit, PropertyResident } from "../domain/types";
import { toast } from "sonner";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">{label}</span>
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

interface ResidentFormProps {
  defaultValues?: Partial<ResidentFormValues>;
  onSubmit: (values: ResidentFormValues) => Promise<void>;
  isPending: boolean;
  onCancel?: () => void;
}

function ResidentForm({ defaultValues, onSubmit, isPending, onCancel }: ResidentFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<ResidentFormValues>({
    resolver: zodResolver(residentSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <Field label="Full name" error={errors.full_name?.message}>
        <input {...register("full_name")} className={inputCls} placeholder="e.g. Jane Smith" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone" error={errors.phone?.message}>
          <input {...register("phone")} className={inputCls} placeholder="+44 7700…" />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input type="email" {...register("email")} className={inputCls} placeholder="jane@…" />
        </Field>
        <Field label="Date of birth">
          <input type="date" {...register("date_of_birth")} className={inputCls} />
        </Field>
        <Field label="Nationality">
          <input {...register("nationality")} className={inputCls} placeholder="e.g. British" />
        </Field>
      </div>
      <Field label="Occupation">
        <input {...register("occupation")} className={inputCls} placeholder="e.g. Software Engineer" />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="submit" variant="secondary" size="sm" loading={isPending}>
          <Check className="h-3.5 w-3.5 mr-1" />
          Save tenant
        </Button>
      </div>
    </form>
  );
}

interface TenantTabProps {
  unit: Unit;
  isEditing: boolean;
  onUnitUpdated: (unit: Unit) => void;
}

export function TenantTab({ unit, isEditing, onUnitUpdated }: TenantTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const resident = unit.resident;

  const handleCreate = async (values: ResidentFormValues) => {
    startTransition(async () => {
      try {
        const newResident = await createResident(values);
        // Link resident to unit
        const updated = await updateUnit(unit.id, { resident_id: newResident.id });
        onUnitUpdated({ ...unit, resident: newResident as PropertyResident, resident_id: newResident.id });
        setShowAddForm(false);
        toast.success("Tenant added");
      } catch {
        toast.error("Failed to add tenant");
      }
    });
  };

  const handleUpdate = async (values: ResidentFormValues) => {
    if (!resident) return;
    startTransition(async () => {
      try {
        const updated = await updateResident(resident.id, values);
        onUnitUpdated({ ...unit, resident: updated as PropertyResident });
        toast.success("Tenant updated");
      } catch {
        toast.error("Failed to update tenant");
      }
    });
  };

  // ── No resident + not adding ──────────────────────────────────────────────
  if (!resident && !showAddForm) {
    return (
      <div className="py-12 text-center">
        <User className="h-10 w-10 text-foreground-muted mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">No tenant assigned</p>
        <p className="text-xs text-foreground-secondary mb-4">This unit is currently vacant.</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setShowAddForm(true)}
        >
          <UserPlus className="h-3.5 w-3.5 mr-1" />
          Add Tenant
        </Button>
      </div>
    );
  }

  // ── Adding new resident form ───────────────────────────────────────────────
  if (!resident && showAddForm) {
    return (
      <div className="py-2">
        <h3 className="text-sm font-semibold text-foreground mb-4">Add Tenant</h3>
        <ResidentForm
          onSubmit={handleCreate}
          isPending={isPending}
          onCancel={() => setShowAddForm(false)}
        />
      </div>
    );
  }

  // ── Existing resident ──────────────────────────────────────────────────────
  if (!isEditing && resident) {
    return (
      <div className="space-y-4 py-1">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-inset border border-border">
          <div className="h-10 w-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-brand">
              {resident.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{resident.full_name}</p>
            <p className="text-xs text-foreground-secondary">{resident.occupation ?? "Tenant"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ReadField label="Phone" value={resident.phone} />
          <ReadField label="Email" value={resident.email} />
          <ReadField label="Date of birth" value={resident.date_of_birth ? new Date(resident.date_of_birth).toLocaleDateString("en-GB") : null} />
          <ReadField label="Nationality" value={resident.nationality} />
          <ReadField label="Occupation" value={resident.occupation} />
        </div>
      </div>
    );
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  return (
    <div className="py-1">
      <h3 className="text-sm font-semibold text-foreground mb-4">Edit Tenant</h3>
      <ResidentForm
        defaultValues={{
          full_name: resident?.full_name ?? "",
          phone: resident?.phone ?? "",
          email: resident?.email ?? "",
          date_of_birth: resident?.date_of_birth ?? "",
          nationality: resident?.nationality ?? "",
          occupation: resident?.occupation ?? "",
        }}
        onSubmit={handleUpdate}
        isPending={isPending}
      />
    </div>
  );
}

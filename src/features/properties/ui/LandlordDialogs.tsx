"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createOwnerLandlord,
  createPropertyManager,
  updateOwnerLandlord,
  updatePropertyManager,
} from "../actions/landlords";
import {
  ownerLandlordSchema,
  ownerLandlordEditSchema,
  propertyManagerSchema,
  propertyManagerEditSchema,
  type OwnerLandlordFormValues,
  type PropertyManagerFormValues,
} from "../domain/schemas";
import type { OwnerLandlord, PropertyManager } from "../domain/types";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const selectCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ─── Owner Landlord Dialog ───────────────────────────────── */

interface CreateOwnerLandlordDialogProps {
  onCreated: (landlord: OwnerLandlord) => void;
}

export function CreateOwnerLandlordDialog({ onCreated }: CreateOwnerLandlordDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OwnerLandlordFormValues>({
    resolver: zodResolver(ownerLandlordSchema),
    defaultValues: { alert_60_days: false, alert_30_days: false },
  });

  const onSubmit = (values: OwnerLandlordFormValues) => {
    startTransition(async () => {
      try {
        const landlord = await createOwnerLandlord(values);
        toast.success("Owner landlord created");
        onCreated(landlord);
        reset();
        setOpen(false);
      } catch (err) {
        toast.error("Failed to create landlord", {
          description: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add owner landlord</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-foreground-muted -mt-1">
          The person or company you pay rent to (rent-to-rent model).
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-1">
          <Field label="Name" error={errors.name?.message}>
            <input
              {...register("name")}
              className={inputCls}
              placeholder="e.g. John Smith or Acme Properties Ltd"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input {...register("phone")} className={inputCls} placeholder="+44 7700 000000" />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input {...register("email")} type="email" className={inputCls} placeholder="owner@example.com" />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              Create landlord
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Property Manager Dialog ─────────────────────────────── */

interface CreatePropertyManagerDialogProps {
  onCreated: (manager: PropertyManager) => void;
}

export function CreatePropertyManagerDialog({ onCreated }: CreatePropertyManagerDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PropertyManagerFormValues>({
    resolver: zodResolver(propertyManagerSchema),
  });

  const onSubmit = (values: PropertyManagerFormValues) => {
    startTransition(async () => {
      try {
        const manager = await createPropertyManager(values);
        toast.success("Property manager created");
        onCreated(manager);
        reset();
        setOpen(false);
      } catch (err) {
        toast.error("Failed to create property manager", {
          description: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add property manager</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-foreground-muted -mt-1">
          Someone who gets notified about maintenance tickets for this property.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-1">
          <Field label="Full name" error={errors.full_name?.message}>
            <input
              {...register("full_name")}
              className={inputCls}
              placeholder="e.g. Jane Doe"
              autoFocus
            />
          </Field>

          <Field label="Company (optional)">
            <input
              {...register("company_name")}
              className={inputCls}
              placeholder="e.g. Harbor Ops Management"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input {...register("phone")} className={inputCls} placeholder="+44 7700 000000" />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input
                {...register("email")}
                type="email"
                className={inputCls}
                placeholder="manager@example.com"
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              {...register("notes")}
              rows={2}
              className={inputCls + " min-h-[60px] py-2"}
              placeholder="Optional notes"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              Create property manager
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Edit Owner Landlord Dialog ──────────────────────────── */

interface EditOwnerLandlordDialogProps {
  landlord: OwnerLandlord;
  onUpdated: (landlord: OwnerLandlord) => void;
}

export function EditOwnerLandlordDialog({ landlord, onUpdated }: EditOwnerLandlordDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<OwnerLandlordFormValues>({
    resolver: zodResolver(ownerLandlordEditSchema as unknown as typeof ownerLandlordSchema),
    defaultValues: {
      name: landlord.name ?? "",
      phone: landlord.phone ?? "",
      email: landlord.email ?? "",
      alert_60_days: landlord.alert_60_days,
      alert_30_days: landlord.alert_30_days,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: landlord.name ?? "",
        phone: landlord.phone ?? "",
        email: landlord.email ?? "",
        alert_60_days: landlord.alert_60_days,
        alert_30_days: landlord.alert_30_days,
      });
    }
  }, [open, landlord, reset]);

  const onSubmit = (values: OwnerLandlordFormValues) => {
    startTransition(async () => {
      try {
        const updated = await updateOwnerLandlord(landlord.id, values);
        toast.success("Owner landlord updated");
        onUpdated(updated);
        setOpen(false);
      } catch (err) {
        toast.error("Failed to update landlord", {
          description: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground hover:underline"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit owner landlord</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-1">
          <Field label="Name">
            <input
              {...register("name")}
              className={inputCls}
              placeholder="e.g. John Smith or Acme Properties Ltd"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input {...register("phone")} className={inputCls} placeholder="+44 7700 000000" />
            </Field>
            <Field label="Email">
              <input {...register("email")} className={inputCls} placeholder="owner@example.com" />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Edit Property Manager Dialog ────────────────────────── */

interface EditPropertyManagerDialogProps {
  manager: PropertyManager;
  onUpdated: (manager: PropertyManager) => void;
}

export function EditPropertyManagerDialog({ manager, onUpdated }: EditPropertyManagerDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<PropertyManagerFormValues>({
    resolver: zodResolver(propertyManagerEditSchema as unknown as typeof propertyManagerSchema),
    defaultValues: {
      full_name: manager.full_name ?? "",
      company_name: manager.company_name ?? "",
      phone: manager.phone ?? "",
      email: manager.email ?? "",
      notes: manager.notes ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        full_name: manager.full_name ?? "",
        company_name: manager.company_name ?? "",
        phone: manager.phone ?? "",
        email: manager.email ?? "",
        notes: manager.notes ?? "",
      });
    }
  }, [open, manager, reset]);

  const onSubmit = (values: PropertyManagerFormValues) => {
    startTransition(async () => {
      try {
        const updated = await updatePropertyManager(manager.id, values);
        toast.success("Property manager updated");
        onUpdated(updated);
        setOpen(false);
      } catch (err) {
        toast.error("Failed to update property manager", {
          description: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground hover:underline"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit property manager</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-1">
          <Field label="Full name">
            <input
              {...register("full_name")}
              className={inputCls}
              placeholder="e.g. Jane Doe"
              autoFocus
            />
          </Field>

          <Field label="Company">
            <input
              {...register("company_name")}
              className={inputCls}
              placeholder="e.g. Harbor Ops Management"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input {...register("phone")} className={inputCls} placeholder="+44 7700 000000" />
            </Field>
            <Field label="Email">
              <input
                {...register("email")}
                className={inputCls}
                placeholder="manager@example.com"
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              {...register("notes")}
              rows={2}
              className={inputCls + " min-h-[60px] py-2"}
              placeholder="Optional notes"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

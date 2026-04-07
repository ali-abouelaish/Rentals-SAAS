"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createOwnerLandlord } from "../actions/landlords";
import {
  ownerLandlordSchema,
  type OwnerLandlordFormValues,
} from "../domain/schemas";
import type { OwnerLandlord } from "../domain/types";

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

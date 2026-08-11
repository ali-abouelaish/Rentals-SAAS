"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { createOwner, deleteOwner } from "../actions/owners";
import { ownerLandlordSchema, type OwnerLandlordFormValues } from "../domain/schemas";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <p className="text-[11px] text-foreground-muted mt-0.5 mb-1">{hint}</p>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

/**
 * Minimal create form — name plus optional contact. Everything else (fee,
 * contract dates, address) is filled in on the detail page, so adding a
 * landlord never blocks on details the user may not have to hand.
 */
export function CreateOwnerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OwnerLandlordFormValues>({
    resolver: zodResolver(ownerLandlordSchema),
    defaultValues: { management_fee_type: "none", alert_60_days: false, alert_30_days: false },
  });

  const onSubmit = (values: OwnerLandlordFormValues) => {
    startTransition(async () => {
      const result = await createOwner(values);
      if (!result.ok) {
        toast.error("Could not add landlord", { description: result.error });
        return;
      }
      toast.success("Landlord added.");
      reset();
      setOpen(false);
      router.push(`/owners/${result.id}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Add landlord
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add landlord</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-foreground-muted -mt-1">
          The owner of a property you manage. You can set their fee and contract dates after
          adding them.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <Field label="Name" hint="Person or company. Max 200 characters." htmlFor="new-owner-name" error={errors.name?.message}>
            <input
              id="new-owner-name"
              {...register("name")}
              className={inputCls}
              placeholder="e.g. J. Smith or Acme Properties Ltd"
              autoFocus
            />
          </Field>

          <Field label="Email" hint="Optional now, but required before statements can be emailed." htmlFor="new-owner-email" error={errors.email?.message}>
            <input id="new-owner-email" type="email" {...register("email")} className={inputCls} placeholder="name@example.com" />
          </Field>

          <Field label="Phone" hint="Optional. Include the country code, e.g. +44 7700 900123." htmlFor="new-owner-phone" error={errors.phone?.message}>
            <input id="new-owner-phone" {...register("phone")} className={inputCls} placeholder="+44 7700 900123" />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              Add landlord
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteOwnerButton({ ownerId, ownerName }: { ownerId: string; ownerName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onDelete = () => {
    const ok = window.confirm(
      `Delete landlord "${ownerName}"? Their properties will lose their owner link. This cannot be undone.`
    );
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteOwner(ownerId);
      if (!result.ok) {
        toast.error("Could not delete", { description: result.error });
        return;
      }
      toast.success("Landlord deleted.");
      router.push("/owners");
    });
  };

  return (
    <Tooltip content="Blocked while this landlord still has statements — those are a financial record and would be deleted with them.">
      <Button variant="destructive" size="sm" loading={isPending} onClick={onDelete}>
        <Trash2 className="h-4 w-4 mr-1.5" />
        Delete landlord
      </Button>
    </Tooltip>
  );
}

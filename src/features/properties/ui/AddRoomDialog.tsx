"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import { createUnit } from "../actions/units";
import type { Property, Unit } from "../domain/types";

const addRoomSchema = z.object({
  room_number: z.string().optional().or(z.literal("")),
  room_type: z.enum(["single", "double", "master", "ensuite"]).optional(),
  min_price_pcm: z.coerce.number().int().positive().optional(),
  max_price_pcm: z.coerce.number().int().positive().optional(),
  available_date: z.string().optional().or(z.literal("")),
});
type AddRoomValues = z.infer<typeof addRoomSchema>;

const ROOM_TYPES: { value: "single" | "double" | "master" | "ensuite"; label: string }[] = [
  { value: "single",  label: "Single"  },
  { value: "double",  label: "Double"  },
  { value: "master",  label: "Master"  },
  { value: "ensuite", label: "Ensuite" },
];

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm transition-colors placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

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
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface AddRoomDialogProps {
  property: Property;
  onCreated: (unit: Unit) => void;
}

export function AddRoomDialog({ property, onCreated }: AddRoomDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isHmo = property.property_type === "hmo";

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<AddRoomValues>({
    resolver: zodResolver(addRoomSchema),
    defaultValues: { room_type: "double" },
  });

  const onSubmit = (values: AddRoomValues) => {
    startTransition(async () => {
      try {
        const unitType = isHmo ? "room" : (property.property_type as "studio" | "whole_flat");
        const newUnit = await createUnit({
          property_id: property.id,
          unit_type: unitType,
          room_number: values.room_number || null,
          room_type: isHmo ? (values.room_type ?? null) : null,
          status: "available",
          min_price_pcm: values.min_price_pcm ?? null,
          max_price_pcm: values.max_price_pcm ?? null,
          available_date: values.available_date || null,
          notice_given: false,
          couples_allowed: false,
          furnishings: property.furnished ? "furnished" : "unfurnished",
        });

        // Enrich with property data so the list renders correctly
        const enriched: Unit = {
          ...newUnit,
          property: { ...property },
          resident: null,
        };

        toast.success(isHmo ? "Room added" : "Unit added");
        onCreated(enriched);
        reset();
        setOpen(false);
      } catch (err) {
        toast.error("Failed to add room", {
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-brand/40 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add room
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add room</DialogTitle>
          <p className="text-xs text-foreground-muted mt-0.5">{property.name}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {isHmo && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Room number">
                <input
                  {...register("room_number")}
                  className={inputCls}
                  placeholder="e.g. 3"
                />
              </Field>
              <Field label="Room type">
                <Controller
                  name="room_type"
                  control={control}
                  render={({ field }) => (
                    <div className="flex rounded-lg border border-border bg-surface-inset p-0.5 gap-0.5">
                      {ROOM_TYPES.map((rt) => (
                        <button
                          key={rt.value}
                          type="button"
                          onClick={() => field.onChange(rt.value)}
                          className={cn(
                            "flex-1 py-1 text-[10px] font-medium rounded-md transition-all",
                            field.value === rt.value
                              ? "bg-surface-card text-foreground shadow-xs"
                              : "text-foreground-muted hover:text-foreground"
                          )}
                        >
                          {rt.label}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Min PCM (£)" error={errors.min_price_pcm?.message}>
              <input
                type="number"
                min="1"
                {...register("min_price_pcm")}
                className={inputCls}
                placeholder="700"
              />
            </Field>
            <Field label="Max PCM (£)" error={errors.max_price_pcm?.message}>
              <input
                type="number"
                min="1"
                {...register("max_price_pcm")}
                className={inputCls}
                placeholder="800"
              />
            </Field>
          </div>

          <Field label="Available from">
            <input type="date" {...register("available_date")} className={inputCls} />
          </Field>

          <div className="flex justify-end gap-2 pt-1 border-t border-border">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground-secondary hover:bg-surface-inset transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
            >
              {isPending ? "Adding…" : "Add room"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

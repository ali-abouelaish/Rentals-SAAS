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
import { createProperty } from "../actions/properties";
import { propertySchema, type PropertyFormValues } from "../domain/schemas";
import { LONDON_AREAS } from "../domain/types";
import type { Portfolio, Unit } from "../domain/types";

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

interface CreatePropertyDialogProps {
  portfolios: Portfolio[];
  onCreated: (newUnits: Unit[]) => void;
}

export function CreatePropertyDialog({ portfolios, onCreated }: CreatePropertyDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      property_type: "hmo",
      furnished: true,
      parking: false,
      garden: false,
      broadband: true,
      washing_machine: true,
      dishwasher: false,
      central_heating: true,
      separate_wc: false,
      smoker_ok: false,
      pets_ok: false,
      preferred_occupation: "any",
      preferred_gender: "any",
      bills: "all_included",
    },
  });

  const propertyType = watch("property_type");

  const onSubmit = (values: PropertyFormValues) => {
    startTransition(async () => {
      try {
        await createProperty(values);
        toast.success("Property created", {
          description:
            values.property_type !== "hmo"
              ? "A unit has been automatically created for this property."
              : "Add rooms via the Units view.",
        });
        reset();
        setOpen(false);
        // Reload page to pick up new data from server
        window.location.reload();
      } catch (err) {
        toast.error("Failed to create property", {
          description: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Property
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Property</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {/* Type + Portfolio */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Property type" error={errors.property_type?.message}>
              <select {...register("property_type")} className={selectCls}>
                <option value="hmo">HMO (rooms)</option>
                <option value="studio">Studio</option>
                <option value="whole_flat">Whole Flat</option>
              </select>
            </Field>
            <Field label="Portfolio">
              <select {...register("portfolio_id")} className={selectCls}>
                <option value="">— None —</option>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Name / address */}
          <Field label="Property name" error={errors.name?.message}>
            <input
              {...register("name")}
              className={inputCls}
              placeholder="e.g. 14 Mastmaker Road"
            />
          </Field>

          <Field label="Address line 1" error={errors.address_line_1?.message}>
            <input
              {...register("address_line_1")}
              className={inputCls}
              placeholder="Street address"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Address line 2">
              <input
                {...register("address_line_2")}
                className={inputCls}
                placeholder="Flat, building, etc."
              />
            </Field>
            <Field label="Postcode">
              <input {...register("postcode")} className={inputCls} placeholder="e.g. E14 9UB" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Area">
              <input
                {...register("area")}
                list="areas-datalist-dialog"
                className={inputCls}
                placeholder="e.g. Canary Wharf"
                autoComplete="off"
              />
              <datalist id="areas-datalist-dialog">
                {LONDON_AREAS.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </Field>
            <Field label="Nearest tube / station">
              <input
                {...register("nearest_tube_station")}
                className={inputCls}
                placeholder="e.g. Canary Wharf"
              />
            </Field>
          </div>

          {/* HMO-only: room count */}
          {propertyType === "hmo" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total rooms">
                <input
                  type="number"
                  min="1"
                  {...register("total_rooms")}
                  className={inputCls}
                />
              </Field>
              <Field label="Total bathrooms">
                <input
                  type="number"
                  min="1"
                  {...register("total_bathrooms")}
                  className={inputCls}
                />
              </Field>
            </div>
          )}

          {/* Bills */}
          <Field label="Bills">
            <select {...register("bills")} className={selectCls}>
              <option value="all_included">All included</option>
              <option value="top_up_gas_elec">Top-up gas &amp; electric</option>
              <option value="top_up_elec">Top-up electric only</option>
              <option value="top_up_gas">Top-up gas only</option>
            </select>
          </Field>

          {/* Amenities */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Amenities</p>
            <div className="grid grid-cols-3 gap-y-2 gap-x-3">
              {(
                [
                  ["furnished", "Furnished"],
                  ["parking", "Parking"],
                  ["garden", "Garden"],
                  ["broadband", "Broadband"],
                  ["washing_machine", "Washing machine"],
                  ["dishwasher", "Dishwasher"],
                  ["central_heating", "Central heating"],
                  ["separate_wc", "Separate WC"],
                  ["smoker_ok", "Smoker OK"],
                  ["pets_ok", "Pets OK"],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input type="checkbox" {...register(field)} className="rounded border-border" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              Create property
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ExternalLink, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { updateUnit } from "../actions/units";
import { unitSchema, type UnitFormValues } from "../domain/schemas";
import { LONDON_AREAS, type Unit } from "../domain/types";
import { toast } from "sonner";

// ── Helpers ──────────────────────────────────────────────────────────────────

function ReadField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">{label}</span>
      <span className="text-sm text-foreground">{value ?? "—"}</span>
    </div>
  );
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const selectCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function Amenity({ label, value }: { label: string; value: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 text-xs rounded-md px-2 py-1 border",
      value
        ? "bg-green-50 border-green-100 text-green-700"
        : "bg-surface-inset border-border text-foreground-muted line-through"
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", value ? "bg-green-500" : "bg-gray-300")} />
      {label}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface OverviewTabProps {
  unit: Unit;
  isEditing: boolean;
  onSaved: (updated: Unit) => void;
}

export function OverviewTab({ unit, isEditing, onSaved }: OverviewTabProps) {
  const [isPending, startTransition] = useTransition();
  const property = unit.property;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      property_id: unit.property_id,
      unit_type: unit.unit_type,
      room_number: unit.room_number ?? "",
      room_type: unit.room_type ?? undefined,
      status: unit.status,
      notice_given: unit.notice_given,
      available_date: unit.available_date ?? "",
      min_price_pcm: unit.min_price_pcm ?? undefined,
      max_price_pcm: unit.max_price_pcm ?? undefined,
      couples_allowed: unit.couples_allowed,
      couples_price_pcm: unit.couples_price_pcm ?? undefined,
      deposit: unit.deposit ?? undefined,
      furnishings: unit.furnishings,
      drive_folder_url: unit.drive_folder_url ?? "",
    },
  });

  const noticeGiven = watch("notice_given");
  const couplesAllowed = watch("couples_allowed");
  const unitType = unit.unit_type;

  const onSubmit = (values: UnitFormValues) => {
    startTransition(async () => {
      try {
        const updated = await updateUnit(unit.id, values);
        toast.success("Unit saved");
        onSaved(updated as unknown as Unit);
      } catch {
        toast.error("Failed to save unit");
      }
    });
  };

  if (!isEditing) {
    // ── Read mode ────────────────────────────────────────────────────────────
    return (
      <div className="space-y-6 py-1">
        {/* Unit fields */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-3">Unit Details</h3>
          <div className="grid grid-cols-2 gap-3">
            <ReadField label="Type" value={unit.unit_type.replace("_", " ")} />
            {unitType === "room" && (
              <>
                <ReadField label="Room number" value={unit.room_number} />
                <ReadField label="Room type" value={unit.room_type} />
              </>
            )}
            <ReadField label="Furnishings" value={unit.furnishings} />
            <ReadField label="Status" value={unit.status.replace("_", " ")} />
            <ReadField label="Notice given" value={unit.notice_given ? "Yes" : "No"} />
            <ReadField
              label="Available from"
              value={
                unit.available_date
                  ? new Date(unit.available_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                  : null
              }
            />
          </div>
        </section>

        {/* Pricing */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-3">Pricing</h3>
          <div className="grid grid-cols-2 gap-3">
            <ReadField label="Min PCM" value={unit.min_price_pcm ? `£${unit.min_price_pcm.toLocaleString()}` : null} />
            <ReadField label="Max PCM" value={unit.max_price_pcm ? `£${unit.max_price_pcm.toLocaleString()}` : null} />
            <ReadField label="Deposit" value={unit.deposit ? `£${unit.deposit.toLocaleString()}` : null} />
            {unit.couples_allowed && (
              <ReadField label="Couples price" value={unit.couples_price_pcm ? `£${unit.couples_price_pcm.toLocaleString()}` : null} />
            )}
          </div>
        </section>

        {/* Drive folder link */}
        {unit.drive_folder_url && (
          <section>
            <a
              href={unit.drive_folder_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-foreground-link hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Google Drive folder
            </a>
          </section>
        )}

        {/* Property summary */}
        {property && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-3">Property</h3>
            <div className="rounded-lg border border-border bg-surface-inset p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-foreground-muted">Area</span>
                  <p className="text-foreground font-medium">{property.area ?? "—"}</p>
                </div>
                <div>
                  <span className="text-foreground-muted">Tube</span>
                  <p className="text-foreground font-medium">{property.nearest_tube_station ?? "—"}</p>
                </div>
                <div>
                  <span className="text-foreground-muted">Bills</span>
                  <p className="text-foreground font-medium">{property.bills?.replace(/_/g, " ") ?? "—"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                <Amenity label="Parking" value={property.parking} />
                <Amenity label="Garden" value={property.garden} />
                <Amenity label="Broadband" value={property.broadband} />
                <Amenity label="Washing machine" value={property.washing_machine} />
                <Amenity label="Dishwasher" value={property.dishwasher} />
                <Amenity label="Central heating" value={property.central_heating} />
                <Amenity label="Separate WC" value={property.separate_wc} />
                <Amenity label="Smoker OK" value={property.smoker_ok} />
                <Amenity label="Pets OK" value={property.pets_ok} />
              </div>
              {property.floor_plan_url && (
                <div className="flex items-center gap-1 text-xs text-foreground-muted border-t border-border pt-2 mt-1">
                  <Lock className="h-3 w-3" />
                  <span>Floor plan available (restricted)</span>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-1">
      {unitType === "room" && (
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Room number" error={errors.room_number?.message}>
            <input {...register("room_number")} className={inputCls} placeholder="e.g. 3" />
          </FormField>
          <FormField label="Room type" error={errors.room_type?.message}>
            <select {...register("room_type")} className={selectCls}>
              <option value="">Select…</option>
              <option value="single">Single</option>
              <option value="double">Double</option>
              <option value="master">Master</option>
              <option value="ensuite">Ensuite</option>
            </select>
          </FormField>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Status">
          <select {...register("status")} className={selectCls}>
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="move_out">Move Out</option>
            <option value="booked">Booked</option>
            <option value="on_hold">On Hold</option>
            <option value="renewal">Renewal</option>
            <option value="replacement">Replacement</option>
          </select>
        </FormField>
        <FormField label="Furnishings">
          <select {...register("furnishings")} className={selectCls}>
            <option value="furnished">Furnished</option>
            <option value="unfurnished">Unfurnished</option>
            <option value="part_furnished">Part Furnished</option>
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Notice given">
          <select
            {...register("notice_given", { setValueAs: (v) => v === "true" })}
            className={selectCls}
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </FormField>
        <FormField label="Available from">
          <input type="date" {...register("available_date")} className={inputCls} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Min PCM (£)">
          <input type="number" {...register("min_price_pcm")} className={inputCls} />
        </FormField>
        <FormField label="Max PCM (£)">
          <input type="number" {...register("max_price_pcm")} className={inputCls} />
        </FormField>
        <FormField label="Deposit (£)">
          <input type="number" {...register("deposit")} className={inputCls} />
        </FormField>
      </div>

      <FormField label="Couples allowed">
        <select
          {...register("couples_allowed", { setValueAs: (v) => v === "true" })}
          className={selectCls}
        >
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      </FormField>

      {couplesAllowed && (
        <FormField label="Couples price PCM (£)">
          <input type="number" {...register("couples_price_pcm")} className={inputCls} />
        </FormField>
      )}

      <FormField label="Google Drive folder URL">
        <input {...register("drive_folder_url")} className={inputCls} placeholder="https://drive.google.com/…" />
      </FormField>

      <div className="flex justify-end pt-2">
        <Button type="submit" variant="secondary" size="sm" loading={isPending}>
          <Check className="h-3.5 w-3.5 mr-1" />
          Save changes
        </Button>
      </div>
    </form>
  );
}

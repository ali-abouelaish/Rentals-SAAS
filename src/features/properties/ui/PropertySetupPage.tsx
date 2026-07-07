"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  X,
  ImageIcon,
  Trash2,
  DoorOpen,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { updateUnit } from "../actions/units";
import { saveUnitPhoto, deleteUnitPhoto } from "../actions/photos";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PortfolioBadge } from "./PortfolioBadge";
import { UnitStatusBadge } from "./UnitStatusBadge";
import { DeleteRoomButton } from "./DeleteRoomButton";
import { AddRoomDialog } from "./AddRoomDialog";
import type { Property, Unit, UnitPhoto } from "../domain/types";

/* ─── helpers ─────────────────────────────────────────────── */

const inputCls =
  "h-10 w-full rounded-xl border border-border bg-surface-inset px-3.5 text-sm transition-colors placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-foreground-muted">{hint}</p>}
    </div>
  );
}

function TypePill({
  value,
  label,
  active,
  onClick,
}: {
  value: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all",
        active
          ? "border-brand bg-brand/10 text-brand"
          : "border-border bg-surface-inset text-foreground-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

const ROOM_TYPES = [
  { value: "single",  label: "Single"  },
  { value: "double",  label: "Double"  },
  { value: "master",  label: "Master"  },
  { value: "ensuite", label: "Ensuite" },
] as const;

/* ─── RoomSetupCard ──────────────────────────────────────── */

function RoomSetupCard({
  unit: initialUnit,
  onUpdated,
  onDeleted,
}: {
  unit: Unit;
  onUpdated: (updated: Unit) => void;
  onDeleted: (unitId: string) => void;
}) {
  const [unit, setUnit] = useState(initialUnit);
  const [isEditing, setIsEditing] = useState(false);
  const [unitPhotos, setUnitPhotos] = useState<UnitPhoto[]>([]);
  const [photosLoaded, setPhotosLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, control, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      room_number: unit.room_number ?? "",
      room_type: unit.room_type ?? null as string | null,
      min_price_pcm: unit.min_price_pcm ?? ("" as unknown as number),
      max_price_pcm: unit.max_price_pcm ?? ("" as unknown as number),
      available_date: unit.available_date ?? "",
    },
  });

  const watchedRoomType = watch("room_type");

  const loadPhotos = async () => {
    if (photosLoaded) return;
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("unit_photos")
        .select("*")
        .eq("unit_id", unit.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      setUnitPhotos((data ?? []) as UnitPhoto[]);
      setPhotosLoaded(true);
    } catch {
      // ignore
    }
  };

  const handleEdit = () => {
    reset({
      room_number: unit.room_number ?? "",
      room_type: unit.room_type ?? null,
      min_price_pcm: unit.min_price_pcm ?? ("" as unknown as number),
      max_price_pcm: unit.max_price_pcm ?? ("" as unknown as number),
      available_date: unit.available_date ?? "",
    });
    loadPhotos();
    setIsEditing(true);
  };

  const handleCancel = () => {
    reset();
    setIsEditing(false);
  };

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        const updated = await updateUnit(unit.id, {
          room_number: values.room_number || undefined,
          room_type: (values.room_type as "single" | "double" | "master" | "ensuite") || undefined,
          min_price_pcm: values.min_price_pcm ? Number(values.min_price_pcm) : undefined,
          max_price_pcm: values.max_price_pcm ? Number(values.max_price_pcm) : undefined,
          available_date: values.available_date || undefined,
        });
        const newUnit = { ...unit, ...updated };
        setUnit(newUnit);
        onUpdated(newUnit);
        setIsEditing(false);
      } catch (err) {
        toast.error("Failed to save room", {
          description: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    });
  });

  const handlePhotoUpload = async (file: File) => {
    const supabase = createSupabaseBrowserClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${unit.tenant_id}/${unit.property_id}/units/${unit.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("property_photos")
      .upload(path, file);
    if (uploadError) {
      toast.error("Failed to upload photo");
      return;
    }
    const { data: urlData } = supabase.storage.from("property_photos").getPublicUrl(path);
    try {
      const saved = await saveUnitPhoto({
        url: urlData.publicUrl,
        category: "room",
        unit_id: unit.id,
        property_id: unit.property_id,
      });
      setUnitPhotos((prev) => [...prev, saved]);
    } catch {
      toast.error("Failed to save photo record");
    }
  };

  const handleDeletePhoto = async (photo: UnitPhoto) => {
    try {
      await deleteUnitPhoto(photo.id);
      setUnitPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch {
      toast.error("Failed to delete photo");
    }
  };

  const roomLabel = unit.room_number ? `Room ${unit.room_number}` : "Unnamed room";
  const isConfigured = !!(unit.room_number || unit.max_price_pcm);

  return (
    <div className={cn(
      "rounded-bento bg-surface-card shadow-bento overflow-hidden transition-all",
      isConfigured && !isEditing && "ring-1 ring-brand/10"
    )}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-inset border border-border">
            <DoorOpen className="h-4 w-4 text-foreground-muted" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{roomLabel}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {unit.room_type && (
                <span className="text-xs text-foreground-secondary capitalize">{unit.room_type}</span>
              )}
              {unit.room_type && (unit.min_price_pcm || unit.max_price_pcm) && (
                <span className="text-xs text-foreground-muted">·</span>
              )}
              {(unit.min_price_pcm || unit.max_price_pcm) && (
                <span className="text-xs text-foreground-secondary">
                  £{unit.min_price_pcm ?? "?"}{unit.max_price_pcm ? `–${unit.max_price_pcm}` : ""} pcm
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UnitStatusBadge status={unit.status} />
          {!isEditing && (
            <>
              <button
                type="button"
                onClick={handleEdit}
                className="flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-surface-inset hover:bg-surface-card transition-colors text-foreground-muted hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <DeleteRoomButton unitId={unit.id} roomLabel={roomLabel} onDeleted={onDeleted} />
            </>
          )}
        </div>
      </div>

      {/* Edit form */}
      {isEditing && (
        <form onSubmit={onSubmit} className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Room number">
              <input
                {...register("room_number")}
                className={inputCls}
                placeholder="e.g. 1A"
              />
            </Field>
            <Field label="Available from">
              <input
                type="date"
                {...register("available_date")}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Room type">
            <div className="flex flex-wrap gap-2">
              {ROOM_TYPES.map((rt) => (
                <TypePill
                  key={rt.value}
                  value={rt.value}
                  label={rt.label}
                  active={watchedRoomType === rt.value}
                  onClick={() =>
                    setValue("room_type", watchedRoomType === rt.value ? null : rt.value)
                  }
                />
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Min PCM (£)">
              <input
                type="number"
                min="0"
                {...register("min_price_pcm")}
                className={inputCls}
                placeholder="750"
              />
            </Field>
            <Field label="Max PCM (£)">
              <input
                type="number"
                min="0"
                {...register("max_price_pcm")}
                className={inputCls}
                placeholder="850"
              />
            </Field>
          </div>

          {/* Room photos */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Photos</p>
            <div className="flex flex-wrap gap-2">
              {unitPhotos.map((photo) => (
                <div key={photo.id} className="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border border-border group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="Room photo" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(photo)}
                    className="absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-surface-inset text-foreground-muted hover:border-brand/40 hover:text-brand transition-colors"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save room"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground-secondary hover:bg-surface-card transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Collapsed photo strip */}
      {!isEditing && unitPhotos.length > 0 && (
        <div className="px-5 py-3 flex gap-2 flex-wrap border-t border-border">
          {unitPhotos.map((photo) => (
            <div key={photo.id} className="h-10 w-10 rounded-lg overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="Room photo" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── right panel: property photos ──────────────────────── */

const COMMUNAL_CATEGORIES: Array<{ value: UnitPhoto["category"]; label: string }> = [
  { value: "exterior", label: "Exterior" },
  { value: "communal", label: "Communal" },
  { value: "kitchen",  label: "Kitchen"  },
  { value: "bathroom", label: "Bathroom" },
  { value: "garden",   label: "Garden"   },
  { value: "wc",       label: "WC"       },
];

function PropertyPhotosPanel({
  property,
  initialPhotos,
}: {
  property: Property;
  initialPhotos: UnitPhoto[];
}) {
  const [photos, setPhotos] = useState<UnitPhoto[]>(initialPhotos);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleUpload = async (file: File, category: UnitPhoto["category"]) => {
    const supabase = createSupabaseBrowserClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${property.tenant_id}/${property.id}/communal/${category}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("property_photos").upload(path, file);
    if (error) { toast.error("Failed to upload photo"); return; }
    const { data: urlData } = supabase.storage.from("property_photos").getPublicUrl(path);
    try {
      const saved = await saveUnitPhoto({
        url: urlData.publicUrl,
        category,
        property_id: property.id,
      });
      setPhotos((prev) => [...prev, saved]);
    } catch {
      toast.error("Failed to save photo record");
    }
  };

  const handleDelete = async (photo: UnitPhoto) => {
    try {
      await deleteUnitPhoto(photo.id);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch {
      toast.error("Failed to delete photo");
    }
  };

  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-5 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Common area photos</p>
      <div className="space-y-4">
        {COMMUNAL_CATEGORIES.map(({ value, label }) => {
          const catPhotos = photos.filter((p) => p.category === value);
          return (
            <div key={value} className="space-y-1.5">
              <p className="text-xs font-medium text-foreground-secondary">{label}</p>
              <div className="flex flex-wrap gap-2">
                {catPhotos.map((photo) => (
                  <div key={photo.id} className="relative h-14 w-14 shrink-0 rounded-lg overflow-hidden border border-border group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={label} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleDelete(photo)}
                      className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileRefs.current[value]?.click()}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-surface-inset text-foreground-muted hover:border-brand/40 hover:text-brand transition-colors"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={(el) => { fileRefs.current[value] = el; }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file, value);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── main page ──────────────────────────────────────────── */

export function PropertySetupPage({
  property,
  initialUnits,
  initialPropertyPhotos,
}: {
  property: Property;
  initialUnits: Unit[];
  initialPropertyPhotos: UnitPhoto[];
}) {
  const router = useRouter();
  const [units, setUnits] = useState(initialUnits);

  const handleUnitUpdated = (updated: Unit) => {
    setUnits((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
  };

  const handleUnitDeleted = (unitId: string) => {
    setUnits((prev) => prev.filter((u) => u.id !== unitId));
  };

  const handleUnitCreated = (unit: Unit) => {
    setUnits((prev) => [...prev, unit]);
  };

  const configuredCount = units.filter((u) => !!(u.room_number || u.max_price_pcm)).length;

  const typeLabel =
    property.property_type === "hmo"
      ? "HMO"
      : property.property_type === "studio"
      ? "Studio"
      : "Whole Flat";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-xl border border-border bg-surface-card hover:bg-surface-inset transition-colors text-foreground-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Set up rooms</h1>
            <p className="text-sm text-foreground-secondary mt-0.5">
              Configure each room and upload photos — you can always edit later
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AddRoomDialog property={property} onCreated={handleUnitCreated} />
          <Link
            href={`/properties/${property.id}/edit`}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-card px-4 py-2 text-sm font-medium text-foreground-secondary hover:bg-surface-inset hover:text-foreground transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit details
          </Link>
          <button
            type="button"
            onClick={() => router.push("/properties")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
          >
            Finish setup
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Left: room cards */}
        <div className="lg:col-span-2 space-y-4">
          {units.length === 0 ? (
            <div className="rounded-bento bg-surface-card shadow-bento py-16 text-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
                <DoorOpen className="h-7 w-7 text-brand" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">No rooms yet</p>
              <p className="text-xs text-foreground-secondary max-w-xs mx-auto">
                Use the “Add room” button above to create rooms for this property.
              </p>
            </div>
          ) : (
            units.map((unit) => (
              <RoomSetupCard
                key={unit.id}
                unit={unit}
                onUpdated={handleUnitUpdated}
                onDeleted={handleUnitDeleted}
              />
            ))
          )}
        </div>

        {/* Right: sticky summary + photos */}
        <div className="lg:col-span-1 lg:sticky lg:top-6 space-y-4">
          {/* Summary card */}
          <div className="rounded-bento bg-surface-card shadow-bento overflow-hidden">
            <div className="h-1.5 w-full bg-brand" />
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 text-xs font-semibold text-brand">
                  {typeLabel}
                </span>
                {property.portfolio && (
                  <PortfolioBadge portfolio={property.portfolio} />
                )}
              </div>
              <div>
                <p className="text-base font-bold text-foreground">{property.name}</p>
                <p className="text-xs text-foreground-muted mt-0.5">
                  {[property.address_line_1, property.postcode].filter(Boolean).join(", ")}
                </p>
              </div>
              <div className="pt-2 border-t border-border space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground-secondary">Rooms</span>
                  <span className="font-medium text-foreground">{units.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground-secondary">Configured</span>
                  <span className={cn(
                    "font-semibold",
                    configuredCount === units.length && units.length > 0
                      ? "text-green-600"
                      : "text-foreground"
                  )}>
                    {configuredCount} / {units.length}
                  </span>
                </div>
                {units.length > 0 && (
                  <div className="h-1.5 w-full rounded-full bg-surface-inset overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand transition-all"
                      style={{ width: `${(configuredCount / units.length) * 100}%` }}
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => router.push("/properties")}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors"
              >
                Finish setup
              </button>
            </div>
          </div>

          {/* Property-level photos */}
          <PropertyPhotosPanel
            property={property}
            initialPhotos={initialPropertyPhotos}
          />
        </div>
      </div>
    </div>
  );
}

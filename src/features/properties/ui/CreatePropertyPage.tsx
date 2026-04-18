"use client";

import { useTransition, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  MapPin,
  LayoutList,
  Zap,
  Users,
  Wifi,
  Car,
  TreePine,
  WashingMachine,
  Utensils,
  Flame,
  DoorOpen,
  Cigarette,
  PawPrint,
  CheckCircle2,
  Home,
  Layers,
  ImageIcon,
  X,
  KeyRound,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { createProperty, updateProperty } from "../actions/properties";
import { saveUnitPhoto } from "../actions/photos";
import { propertySchema, type PropertyFormValues } from "../domain/schemas";
import { LONDON_AREAS } from "../domain/types";
import type { Portfolio, Property, UnitPhoto, OwnerLandlord, PropertyManager } from "../domain/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CreateOwnerLandlordDialog, CreatePropertyManagerDialog } from "./LandlordDialogs";

/* ─── primitives ─────────────────────────────────────────── */

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-foreground-muted">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-border bg-surface-inset px-3.5 text-sm transition-colors placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

const selectCls =
  "h-10 w-full rounded-xl border border-border bg-surface-inset px-3.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

/* Card-style multi-choice selector */
function ChoiceGroup<T extends string>({
  value,
  onChange,
  options,
  cols = 3,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; description?: string; icon?: React.ElementType }[];
  cols?: 2 | 3 | 4;
}) {
  const gridCols = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[cols];
  return (
    <div className={cn("grid gap-2", gridCols)}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-all",
              active
                ? "border-brand bg-brand/5 ring-1 ring-brand/30"
                : "border-border bg-surface-inset hover:bg-surface-card hover:border-border/80"
            )}
          >
            {active && <CheckCircle2 className="absolute top-2.5 right-2.5 h-3.5 w-3.5 text-brand" />}
            {Icon && <Icon className={cn("h-4 w-4 mb-1.5", active ? "text-brand" : "text-foreground-muted")} strokeWidth={1.8} />}
            <span className={cn("text-sm font-semibold", active ? "text-brand" : "text-foreground")}>{opt.label}</span>
            {opt.description && (
              <span className="text-xs text-foreground-muted mt-0.5 leading-snug">{opt.description}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* Compact inline pill selector */
function PillGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex rounded-xl border border-border bg-surface-inset p-0.5 w-fit">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
            value === opt.value
              ? "bg-surface-card text-foreground shadow-sm"
              : "text-foreground-muted hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* Toggle chip for boolean amenity */
function ToggleChip({
  checked,
  onChange,
  icon: Icon,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all select-none w-full",
        checked
          ? "border-brand bg-brand/10 text-brand"
          : "border-border bg-surface-inset text-foreground-muted hover:text-foreground hover:bg-surface-card"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
      <span className="truncate">{label}</span>
      <span
        className={cn(
          "ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          checked ? "border-brand bg-brand" : "border-border"
        )}
      >
        {checked && (
          <svg viewBox="0 0 8 8" fill="none" className="h-2.5 w-2.5">
            <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}

/* Section card matching the bento style */
function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-6 space-y-4">
      <div className="flex items-center gap-3 pb-1 border-b border-border">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10">
          <Icon className="h-4 w-4 text-brand" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description && <p className="text-xs text-foreground-muted">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ─── data ───────────────────────────────────────────────── */

const PROPERTY_TYPES = [
  { value: "hmo" as const,       label: "HMO",        description: "Multiple rooms, shared facilities", icon: Layers    },
  { value: "studio" as const,    label: "Studio",     description: "Self-contained studio unit",        icon: Home      },
  { value: "whole_flat" as const, label: "Whole Flat", description: "Entire flat or apartment",         icon: Building2 },
];

const BILLS_OPTIONS = [
  { value: "all_included" as const,    label: "All included",       description: "Fully covered in rent"         },
  { value: "top_up_gas_elec" as const, label: "Top-up gas & elec",  description: "Tenant pays gas & electric"    },
  { value: "top_up_elec" as const,     label: "Top-up electric",    description: "Tenant pays electric only"     },
  { value: "top_up_gas" as const,      label: "Top-up gas",         description: "Tenant pays gas only"          },
];

const OCCUPATION_OPTIONS = [
  { value: "professional" as const, label: "Professional" },
  { value: "student" as const,      label: "Student"      },
  { value: "any" as const,          label: "Any"          },
];

const GENDER_OPTIONS = [
  { value: "male" as const,   label: "Male"   },
  { value: "female" as const, label: "Female" },
  { value: "any" as const,    label: "Any"    },
];

const AMENITIES: Array<{ key: keyof PropertyFormValues; label: string; icon: React.ElementType }> = [
  { key: "furnished",       label: "Furnished",       icon: LayoutList     },
  { key: "broadband",       label: "Broadband",       icon: Wifi           },
  { key: "parking",         label: "Parking",         icon: Car            },
  { key: "garden",          label: "Garden",          icon: TreePine       },
  { key: "washing_machine", label: "Washing machine", icon: WashingMachine },
  { key: "dishwasher",      label: "Dishwasher",      icon: Utensils       },
  { key: "central_heating", label: "Central heating", icon: Flame          },
  { key: "separate_wc",     label: "Separate WC",     icon: DoorOpen       },
  { key: "smoker_ok",       label: "Smoker OK",       icon: Cigarette      },
  { key: "pets_ok",         label: "Pets OK",         icon: PawPrint       },
];

/* ─── summary panel ──────────────────────────────────────── */

function SummaryPanel({
  values,
  portfolios,
}: {
  values: PropertyFormValues;
  portfolios: Portfolio[];
}) {
  const portfolio = portfolios.find((p) => p.id === values.portfolio_id);
  const typeLabel = PROPERTY_TYPES.find((t) => t.value === values.property_type)?.label ?? "—";
  const billsLabel = BILLS_OPTIONS.find((b) => b.value === values.bills)?.label ?? "—";
  const activeAmenities = AMENITIES.filter((a) => values[a.key]);

  return (
    <div className="space-y-4">
      {/* Preview card */}
      <div className="rounded-bento bg-surface-card shadow-bento overflow-hidden">
        <div className="h-1.5 w-full bg-brand" />
        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-3">Preview</p>

          <div className="space-y-3">
            {/* Type + portfolio */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 text-xs font-semibold text-brand">
                {typeLabel}
              </span>
              {portfolio && (
                <span
                  className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                  style={{ backgroundColor: portfolio.color + "18", borderColor: portfolio.color + "40", color: portfolio.color }}
                >
                  {portfolio.name}
                </span>
              )}
            </div>

            {/* Name */}
            <div>
              <p className="text-base font-bold text-foreground leading-tight">
                {values.name || <span className="text-foreground-muted font-normal italic">Property name…</span>}
              </p>
              {values.address_line_1 && (
                <p className="text-xs text-foreground-muted mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {[values.address_line_1, values.postcode, values.area].filter(Boolean).join(", ")}
                </p>
              )}
              {values.nearest_tube_station && (
                <p className="text-xs text-foreground-muted mt-0.5">
                  📍 Near {values.nearest_tube_station}
                </p>
              )}
            </div>

            {/* HMO rooms */}
            {values.property_type === "hmo" && (values.total_rooms || values.total_bathrooms) && (
              <p className="text-xs text-foreground-secondary">
                {values.total_rooms ? `${values.total_rooms} rooms` : ""}
                {values.total_rooms && values.total_bathrooms ? " · " : ""}
                {values.total_bathrooms ? `${values.total_bathrooms} bathrooms` : ""}
              </p>
            )}

            {/* Bills */}
            <div className="flex items-center gap-1.5 text-xs text-foreground-secondary">
              <Zap className="h-3 w-3 text-amber-500" />
              {billsLabel}
            </div>

            {/* Amenity chips */}
            {activeAmenities.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {activeAmenities.map(({ key, label }) => (
                  <span key={key} className="rounded-lg bg-surface-inset border border-border px-2 py-0.5 text-[10px] font-medium text-foreground-secondary">
                    {label}
                  </span>
                ))}
              </div>
            )}

            {/* Preferences */}
            {(values.preferred_occupation !== "any" || values.preferred_gender !== "any" || values.min_age || values.max_age) && (
              <div className="pt-2 border-t border-border space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Tenant preferences</p>
                <div className="flex flex-wrap gap-1">
                  {values.preferred_occupation !== "any" && (
                    <span className="rounded-lg bg-surface-inset border border-border px-2 py-0.5 text-[10px] font-medium text-foreground-secondary capitalize">
                      {values.preferred_occupation}
                    </span>
                  )}
                  {values.preferred_gender !== "any" && (
                    <span className="rounded-lg bg-surface-inset border border-border px-2 py-0.5 text-[10px] font-medium text-foreground-secondary capitalize">
                      {values.preferred_gender}
                    </span>
                  )}
                  {(values.min_age || values.max_age) && (
                    <span className="rounded-lg bg-surface-inset border border-border px-2 py-0.5 text-[10px] font-medium text-foreground-secondary">
                      Age {values.min_age ?? "any"}–{values.max_age ?? "any"}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-bento bg-surface-card shadow-bento p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-3">Tips</p>
        <ul className="space-y-2.5 text-xs text-foreground-secondary leading-relaxed">
          <li className="flex gap-2">
            <span className="text-brand mt-0.5">→</span>
            <span>HMOs auto-create individual room entries once saved — you can configure each room separately.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand mt-0.5">→</span>
            <span>Studios and Whole Flats get a single unit auto-created on save.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand mt-0.5">→</span>
            <span>Portfolio groups help you filter and report across properties in bulk.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ─── photo upload zone ──────────────────────────────────── */

const COMMUNAL_PHOTO_CATEGORIES: Array<{ value: UnitPhoto["category"]; label: string }> = [
  { value: "exterior",  label: "Exterior"  },
  { value: "communal",  label: "Communal"  },
  { value: "kitchen",   label: "Kitchen"   },
  { value: "bathroom",  label: "Bathroom"  },
  { value: "garden",    label: "Garden"    },
  { value: "wc",        label: "WC"        },
];

interface StagedPhoto {
  file: File;
  category: UnitPhoto["category"];
  preview: string;
}

function PhotoZone({
  category,
  label,
  photos,
  onAdd,
  onRemove,
}: {
  category: UnitPhoto["category"];
  label: string;
  photos: StagedPhoto[];
  onAdd: (files: File[]) => void;
  onRemove: (idx: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const categoryPhotos = photos
    .map((p, idx) => ({ ...p, globalIdx: idx }))
    .filter((p) => p.category === category);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground-secondary">{label}</span>
      <div className="flex flex-wrap gap-2">
        {categoryPhotos.map(({ preview, globalIdx }) => (
          <div key={globalIdx} className="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={label} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(globalIdx)}
              className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-surface-inset text-foreground-muted hover:border-brand/40 hover:text-brand transition-colors"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onAdd(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ─── main component ─────────────────────────────────────── */

export function CreatePropertyPage({
  portfolios,
  initialProperty,
  ownerLandlords: initialOwnerLandlords = [],
  propertyManagers: initialPropertyManagers = [],
}: {
  portfolios: Portfolio[];
  initialProperty?: Property;
  ownerLandlords?: OwnerLandlord[];
  propertyManagers?: PropertyManager[];
}) {
  const isEditMode = !!initialProperty;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [ownerLandlords, setOwnerLandlords] = useState<OwnerLandlord[]>(initialOwnerLandlords);
  const [propertyManagers, setPropertyManagers] = useState<PropertyManager[]>(initialPropertyManagers);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const contractFileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: initialProperty
      ? {
          property_type: initialProperty.property_type,
          name: initialProperty.name,
          portfolio_id: initialProperty.portfolio_id ?? "",
          address_line_1: initialProperty.address_line_1,
          address_line_2: initialProperty.address_line_2 ?? "",
          postcode: initialProperty.postcode ?? "",
          area: initialProperty.area ?? "",
          nearest_tube_station: initialProperty.nearest_tube_station ?? "",
          total_rooms: initialProperty.total_rooms ?? undefined,
          total_bathrooms: initialProperty.total_bathrooms ?? undefined,
          bills: initialProperty.bills ?? "all_included",
          bills_notes: initialProperty.bills_notes ?? "",
          furnished: initialProperty.furnished,
          parking: initialProperty.parking,
          garden: initialProperty.garden,
          broadband: initialProperty.broadband,
          washing_machine: initialProperty.washing_machine,
          dishwasher: initialProperty.dishwasher,
          central_heating: initialProperty.central_heating,
          separate_wc: initialProperty.separate_wc,
          smoker_ok: initialProperty.smoker_ok,
          pets_ok: initialProperty.pets_ok,
          preferred_occupation: initialProperty.preferred_occupation,
          preferred_gender: initialProperty.preferred_gender,
          min_age: initialProperty.min_age ?? undefined,
          max_age: initialProperty.max_age ?? undefined,
          owner_landlord_id: initialProperty.owner_landlord_id ?? "",
          manager_landlord_id: initialProperty.manager_landlord_id ?? "",
          contract_start_date: initialProperty.contract_start_date ?? "",
          contract_expiry_date: initialProperty.contract_expiry_date ?? "",
          monthly_rent_owed: initialProperty.monthly_rent_owed ?? undefined,
          payment_schedule: initialProperty.payment_schedule ?? undefined,
          contract_document_url: initialProperty.contract_document_url ?? "",
        }
      : {
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

  // Live values for the summary panel
  const liveValues = useWatch({ control });
  const propertyType = liveValues.property_type ?? "hmo";

  const onSubmit = (values: PropertyFormValues) => {
    startTransition(async () => {
      try {
        if (isEditMode) {
          let contractUrl = values.contract_document_url ?? null;
          if (contractFile) {
            const supabase = createSupabaseBrowserClient();
            const path = `${initialProperty!.id}/${Date.now()}_${contractFile.name.replace(/\s+/g, "_")}`;
            const { error: uploadError } = await supabase.storage
              .from("property_contracts")
              .upload(path, contractFile);
            if (!uploadError) {
              contractUrl = supabase.storage.from("property_contracts").getPublicUrl(path).data.publicUrl;
            }
          }
          await updateProperty(initialProperty!.id, { ...values, contract_document_url: contractUrl });
          toast.success("Property updated");
          router.push("/properties");
          return;
        }

        let contractUrl: string | null = null;
        if (contractFile) {
          try {
            const supabase = createSupabaseBrowserClient();
            const path = `tmp/${Date.now()}_${contractFile.name.replace(/\s+/g, "_")}`;
            const { error: uploadError } = await supabase.storage
              .from("property_contracts")
              .upload(path, contractFile);
            if (!uploadError) {
              contractUrl = supabase.storage.from("property_contracts").getPublicUrl(path).data.publicUrl;
            }
          } catch {
            // Non-blocking
          }
        }

        const property = await createProperty({ ...values, contract_document_url: contractUrl });

        // Upload staged photos (failures are non-blocking)
        if (stagedPhotos.length > 0) {
          const supabase = createSupabaseBrowserClient();
          for (const staged of stagedPhotos) {
            try {
              const ext = staged.file.name.split(".").pop() || "jpg";
              const path = `${property.tenant_id}/${property.id}/communal/${staged.category}/${Date.now()}.${ext}`;
              const { error: uploadError } = await supabase.storage
                .from("property_photos")
                .upload(path, staged.file);
              if (!uploadError) {
                const { data: urlData } = supabase.storage
                  .from("property_photos")
                  .getPublicUrl(path);
                await saveUnitPhoto({
                  url: urlData.publicUrl,
                  category: staged.category,
                  property_id: property.id,
                });
              }
            } catch {
              // Non-blocking — photos are optional
            }
          }
        }

        if (values.property_type === "hmo") {
          toast.success("Property created", {
            description: "Rooms have been created — configure them on the next screen.",
          });
        } else {
          toast.success("Property created", {
            description: "A unit has been automatically created.",
          });
        }
        router.push(`/properties/${property.id}/setup`);
      } catch (err) {
        toast.error(isEditMode ? "Failed to update property" : "Failed to create property", {
          description: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Page header — matches dashboard pattern */}
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
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {isEditMode ? "Edit property" : "Add property"}
            </h1>
            <p className="text-sm text-foreground-secondary mt-0.5">
              {isEditMode ? `Editing ${initialProperty!.name}` : "Fill in the details below to register a new property"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground-secondary hover:bg-surface-card transition-colors"
          >
            Cancel
          </button>
          <button
            form="create-property-form"
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-brand-fg hover:bg-brand-hover transition-colors disabled:opacity-60"
          >
            {isPending ? "Saving…" : isEditMode ? "Save changes" : "Save property"}
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <form
        id="create-property-form"
        onSubmit={handleSubmit(onSubmit, (fieldErrors) => {
          const labels: Record<string, string> = {
            name: "Property name",
            address_line_1: "Address",
            postcode: "Postcode",
            total_rooms: "Total rooms",
            total_bathrooms: "Bathrooms",
            monthly_rent_owed: "Monthly rent owed",
          };
          const names = Object.keys(fieldErrors);
          const readable = names
            .map((k) => labels[k] ?? k)
            .slice(0, 3)
            .join(", ");
          toast.error(`Fix required fields: ${readable}`);
          const first = document.querySelector<HTMLElement>(
            names.map((n) => `[name="${n}"]`).join(",")
          );
          first?.scrollIntoView({ behavior: "smooth", block: "center" });
          first?.focus({ preventScroll: true });
        })}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
      >
        {/* ── Left: form sections (2 of 3 cols) ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Property type */}
          <SectionCard icon={Building2} title="Property type" description="What kind of property is this?">
            <Controller
              name="property_type"
              control={control}
              render={({ field }) => (
                <ChoiceGroup
                  value={field.value}
                  onChange={field.onChange}
                  options={PROPERTY_TYPES}
                  cols={3}
                />
              )}
            />
          </SectionCard>

          {/* Basic + Location in a 2-col grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <SectionCard icon={Building2} title="Basic details">
              <Field label="Property name" required error={errors.name?.message}>
                <input {...register("name")} className={inputCls} placeholder="e.g. 14 Mastmaker Road" />
              </Field>
              {portfolios.length > 0 && (
                <Field label="Portfolio">
                  <select {...register("portfolio_id")} className={selectCls}>
                    <option value="">— No portfolio —</option>
                    {portfolios.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </Field>
              )}
              {propertyType === "hmo" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Total rooms" error={errors.total_rooms?.message}>
                    <input type="number" min="1" {...register("total_rooms")} className={inputCls} placeholder="6" />
                  </Field>
                  <Field label="Bathrooms" error={errors.total_bathrooms?.message}>
                    <input type="number" min="1" {...register("total_bathrooms")} className={inputCls} placeholder="2" />
                  </Field>
                </div>
              )}
            </SectionCard>

            <SectionCard icon={MapPin} title="Location">
              <Field label="Address" required error={errors.address_line_1?.message}>
                <input {...register("address_line_1")} className={inputCls} placeholder="Street address" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Line 2">
                  <input {...register("address_line_2")} className={inputCls} placeholder="Flat, floor…" />
                </Field>
                <Field label="Postcode" required error={errors.postcode?.message}>
                  <input {...register("postcode")} className={inputCls} placeholder="E14 9UB" />
                </Field>
              </div>
              <Field label="Area">
                <input
                  {...register("area")}
                  list="areas-datalist"
                  className={inputCls}
                  placeholder="e.g. Canary Wharf"
                  autoComplete="off"
                />
                <datalist id="areas-datalist">
                  {LONDON_AREAS.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </Field>
              <Field label="Nearest station">
                <input {...register("nearest_tube_station")} className={inputCls} placeholder="e.g. Canary Wharf" />
              </Field>
            </SectionCard>
          </div>

          {/* Bills */}
          <SectionCard icon={Zap} title="Bills" description="Who covers the utility bills?">
            <Controller
              name="bills"
              control={control}
              render={({ field }) => (
                <ChoiceGroup
                  value={field.value ?? "all_included"}
                  onChange={field.onChange}
                  options={BILLS_OPTIONS}
                  cols={2}
                />
              )}
            />
            <Field label="Bills notes" hint="e.g. £30/month cap, included up to £150">
              <input {...register("bills_notes")} className={inputCls} placeholder="Any notes about the bills arrangement…" />
            </Field>
          </SectionCard>

          {/* Amenities */}
          <SectionCard icon={CheckCircle2} title="Amenities" description="Toggle everything available at this property.">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {AMENITIES.map(({ key, label, icon }) => (
                <Controller
                  key={key}
                  name={key}
                  control={control}
                  render={({ field }) => (
                    <ToggleChip
                      checked={!!field.value}
                      onChange={field.onChange}
                      icon={icon}
                      label={label}
                    />
                  )}
                />
              ))}
            </div>
          </SectionCard>

          {/* Ownership */}
          <SectionCard icon={KeyRound} title="Ownership" description="Associate this property with its landlord and contract details.">
            {/* Owner Landlord */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Owner landlord</label>
                <CreateOwnerLandlordDialog
                  onCreated={(landlord) => {
                    setOwnerLandlords((prev) => [...prev, landlord]);
                  }}
                />
              </div>
              <select {...register("owner_landlord_id")} className={selectCls}>
                <option value="">— None —</option>
                {ownerLandlords.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <p className="text-xs text-foreground-muted">The person or company you pay rent to (rent-to-rent).</p>
            </div>

            {/* Property Manager */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Property manager</label>
                <CreatePropertyManagerDialog
                  onCreated={(manager) => {
                    setPropertyManagers((prev) => [...prev, manager]);
                  }}
                />
              </div>
              <select {...register("manager_landlord_id")} className={selectCls}>
                <option value="">— None —</option>
                {propertyManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                    {m.company_name ? ` · ${m.company_name}` : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-foreground-muted">
                Gets emailed whenever a tenant raises a maintenance ticket here.
              </p>
            </div>

            {/* Contract dates */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contract start">
                <input type="date" {...register("contract_start_date")} className={inputCls} />
              </Field>
              <Field label="Contract expiry">
                <input type="date" {...register("contract_expiry_date")} className={inputCls} />
              </Field>
            </div>

            {/* Rent & schedule */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monthly rent owed (£)">
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-foreground-muted">£</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("monthly_rent_owed")}
                    className={inputCls + " pl-7"}
                    placeholder="0.00"
                  />
                </div>
              </Field>
              <Field label="Payment schedule">
                <select {...register("payment_schedule")} className={selectCls}>
                  <option value="">— Select —</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="biannual">Biannual</option>
                  <option value="annual">Annual</option>
                </select>
              </Field>
            </div>

            {/* Contract document */}
            <Field label="Contract document">
              {contractFile ? (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-inset px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-brand shrink-0" />
                  <span className="flex-1 truncate text-foreground">{contractFile.name}</span>
                  <button type="button" onClick={() => setContractFile(null)} className="text-foreground-muted hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : liveValues.contract_document_url ? (
                <div className="flex items-center gap-3 text-sm">
                  <a href={liveValues.contract_document_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-brand hover:underline">
                    <FileText className="h-3.5 w-3.5" />
                    View current contract
                  </a>
                  <button type="button" onClick={() => contractFileRef.current?.click()} className="text-xs text-foreground-muted hover:text-foreground underline">
                    Replace
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => contractFileRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-surface-inset px-3 py-2 text-sm text-foreground-muted hover:border-brand/40 hover:text-brand transition-colors w-full"
                >
                  <FileText className="h-4 w-4" />
                  Upload contract (PDF or Word)
                </button>
              )}
              <input
                ref={contractFileRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setContractFile(file);
                  e.target.value = "";
                }}
              />
            </Field>
          </SectionCard>

          {/* Tenant preferences */}
          <SectionCard icon={Users} title="Tenant preferences" description="Optional preferences for who this property suits.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Preferred occupation">
                <Controller
                  name="preferred_occupation"
                  control={control}
                  render={({ field }) => (
                    <PillGroup value={field.value} onChange={field.onChange} options={OCCUPATION_OPTIONS} />
                  )}
                />
              </Field>
              <Field label="Preferred gender">
                <Controller
                  name="preferred_gender"
                  control={control}
                  render={({ field }) => (
                    <PillGroup value={field.value} onChange={field.onChange} options={GENDER_OPTIONS} />
                  )}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min age" hint="Leave blank for no minimum">
                <input type="number" min="18" max="99" {...register("min_age")} className={inputCls} placeholder="18" />
              </Field>
              <Field label="Max age" hint="Leave blank for no maximum">
                <input type="number" min="18" max="99" {...register("max_age")} className={inputCls} placeholder="—" />
              </Field>
            </div>
          </SectionCard>

          {/* Common area photos — only on create */}
          {!isEditMode && (
            <SectionCard icon={ImageIcon} title="Common area photos" description="Upload photos of shared spaces — you can add more after saving.">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {COMMUNAL_PHOTO_CATEGORIES.map(({ value, label }) => (
                  <PhotoZone
                    key={value}
                    category={value}
                    label={label}
                    photos={stagedPhotos}
                    onAdd={(files) => {
                      setStagedPhotos((prev) => [
                        ...prev,
                        ...files.map((file) => ({ file, category: value, preview: URL.createObjectURL(file) })),
                      ]);
                    }}
                    onRemove={(idx) => {
                      setStagedPhotos((prev) => {
                        URL.revokeObjectURL(prev[idx].preview);
                        return prev.filter((_, i) => i !== idx);
                      });
                    }}
                  />
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        {/* ── Right: sticky live summary (1 of 3 cols) ── */}
        <div className="lg:col-span-1 lg:sticky lg:top-6">
          <SummaryPanel values={liveValues as PropertyFormValues} portfolios={portfolios} />
        </div>
      </form>
    </div>
  );
}

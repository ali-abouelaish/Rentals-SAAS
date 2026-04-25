"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Wifi,
  Car,
  TreePine,
  WashingMachine,
  Utensils,
  Flame,
  DoorOpen,
  Cigarette,
  PawPrint,
  Zap,
  Users,
  ImageIcon,
  Pencil,
  ChevronRight,
  X,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PortfolioBadge } from "./PortfolioBadge";
import { UnitStatusBadge } from "./UnitStatusBadge";
import { DeletePropertyButton } from "./DeletePropertyButton";
import { PropertyTenantHistory } from "@/features/contracts/ui/PropertyTenantHistory";
import { PropertyKeysTab } from "@/features/keys/ui/PropertyKeysTab";
import type { PropertyHistory } from "@/features/contracts/domain/history";
import type { PropertyKeysPayload } from "@/features/keys/domain/types";
import type { Property, Unit, UnitPhoto } from "../domain/types";
import { Key as KeyIcon } from "lucide-react";

/* ─── lightbox ───────────────────────────────────────────── */

function Lightbox({ photos, startIdx, onClose }: { photos: UnitPhoto[]; startIdx: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIdx);
  const photo = photos[idx];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      {idx > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIdx(idx - 1); }}
          className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <ChevronRight className="h-5 w-5 rotate-180" />
        </button>
      )}
      {idx < photos.length - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIdx(idx + 1); }}
          className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt=""
        className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60 capitalize">
        {photo.category} · {idx + 1} / {photos.length}
      </p>
    </div>
  );
}

/* ─── photo grid ─────────────────────────────────────────── */

function PhotoGrid({ photos, emptyLabel }: { photos: UnitPhoto[]; emptyLabel?: string }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-foreground-muted rounded-xl border border-dashed border-border bg-surface-inset">
        <ImageIcon className="h-6 w-6 mb-2 opacity-40" />
        <p className="text-xs">{emptyLabel ?? "No photos"}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setLightboxIdx(i)}
            className="relative aspect-square rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-brand/30 transition-all group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={photo.category} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </button>
        ))}
      </div>
      {lightboxIdx !== null && (
        <Lightbox photos={photos} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </>
  );
}

/* ─── amenity chip ───────────────────────────────────────── */

function AmenityChip({ icon: Icon, label, active }: { icon: React.ElementType; label: string; active: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
      active
        ? "border-brand/20 bg-brand/5 text-brand"
        : "border-border bg-surface-inset text-foreground-muted opacity-50"
    )}>
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

/* ─── room card ──────────────────────────────────────────── */

function RoomCard({ unit, photos }: { unit: Unit; photos: UnitPhoto[] }) {
  const [expanded, setExpanded] = useState(false);
  const label = unit.room_number ? `Room ${unit.room_number}` : "Unnamed room";

  return (
    <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-inset/40 transition-colors"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-inset border border-border">
          <DoorOpen className="h-4 w-4 text-foreground-muted" strokeWidth={1.8} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{label}</span>
            {unit.room_type && (
              <span className="rounded-full bg-surface-inset border border-border px-2 py-0.5 text-[10px] font-medium text-foreground-muted capitalize">
                {unit.room_type}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {(unit.min_price_pcm || unit.max_price_pcm) && (
              <span className="text-xs text-foreground-secondary">
                £{unit.min_price_pcm ?? "?"}{unit.max_price_pcm ? `–${unit.max_price_pcm}` : ""} pcm
              </span>
            )}
            {unit.available_date && (
              <span className="text-xs text-foreground-muted">
                · Available {new Date(unit.available_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
            {(unit.pm_tenant || unit.resident) && (
              <span className="flex items-center gap-1 text-xs text-foreground-muted">
                · <User className="h-3 w-3" /> {unit.pm_tenant?.full_name ?? unit.resident?.full_name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <UnitStatusBadge status={unit.status} />
          {photos.length > 0 && (
            <span className="text-[10px] font-medium text-foreground-muted bg-surface-inset border border-border rounded-full px-2 py-0.5">
              {photos.length} photo{photos.length !== 1 ? "s" : ""}
            </span>
          )}
          <ChevronRight className={cn("h-4 w-4 text-foreground-muted transition-transform", expanded && "rotate-90")} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border space-y-3">
          {/* Room details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            {unit.furnishings && (
              <div>
                <p className="text-foreground-muted mb-0.5">Furnishings</p>
                <p className="font-medium text-foreground capitalize">{unit.furnishings.replace("_", " ")}</p>
              </div>
            )}
            {unit.deposit && (
              <div>
                <p className="text-foreground-muted mb-0.5">Deposit</p>
                <p className="font-medium text-foreground">£{unit.deposit.toLocaleString()}</p>
              </div>
            )}
            {unit.couples_allowed && (
              <div>
                <p className="text-foreground-muted mb-0.5">Couples</p>
                <p className="font-medium text-foreground">
                  {unit.couples_price_pcm ? `£${unit.couples_price_pcm.toLocaleString()} pcm` : "Allowed"}
                </p>
              </div>
            )}
          </div>

          {/* Photos */}
          <PhotoGrid photos={photos} emptyLabel="No photos for this room" />
        </div>
      )}
    </div>
  );
}

/* ─── main page ──────────────────────────────────────────── */

const AMENITIES: Array<{ key: keyof Property; label: string; icon: React.ElementType }> = [
  { key: "furnished",       label: "Furnished",       icon: DoorOpen       },
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

const BILLS_LABEL: Record<string, string> = {
  all_included:    "All included",
  top_up_gas_elec: "Top-up gas & elec",
  top_up_elec:     "Top-up electric",
  top_up_gas:      "Top-up gas",
};

const COMMUNAL_ORDER: UnitPhoto["category"][] = ["exterior", "communal", "kitchen", "bathroom", "garden", "wc"];

export function PropertyDetailPage({
  property,
  initialUnits,
  allPhotos,
  tenantHistory,
  canCloseout,
  keysPayload,
  agents,
  keysEnabled,
}: {
  property: Property;
  initialUnits: Unit[];
  allPhotos: UnitPhoto[];
  tenantHistory: PropertyHistory;
  canCloseout: boolean;
  keysPayload: PropertyKeysPayload | null;
  agents: Array<{ id: string; name: string }>;
  keysEnabled: boolean;
}) {
  const router = useRouter();
  const units = initialUnits;
  const [activeTab, setActiveTab] = useState<"overview" | "tenants" | "keys">("overview");

  // Separate communal from unit photos
  const communalPhotos = allPhotos.filter((p) => !p.unit_id);
  const communalByCategory = COMMUNAL_ORDER.reduce<Record<string, UnitPhoto[]>>((acc, cat) => {
    acc[cat] = communalPhotos.filter((p) => p.category === cat);
    return acc;
  }, {});
  const hasCommunalPhotos = communalPhotos.length > 0;

  // Per-unit photos
  const photosByUnit = allPhotos.reduce<Record<string, UnitPhoto[]>>((acc, p) => {
    if (p.unit_id) {
      acc[p.unit_id] = [...(acc[p.unit_id] ?? []), p];
    }
    return acc;
  }, {});

  const typeLabel =
    property.property_type === "hmo" ? "HMO"
    : property.property_type === "studio" ? "Studio"
    : "Whole Flat";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.push("/properties")}
            className="mt-1 flex items-center justify-center h-9 w-9 rounded-xl border border-border bg-surface-card hover:bg-surface-inset transition-colors text-foreground-secondary hover:text-foreground shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">{property.name}</h1>
              <span className="rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 text-xs font-semibold text-brand">
                {typeLabel}
              </span>
              {property.portfolio && <PortfolioBadge portfolio={property.portfolio} />}
            </div>
            <p className="flex items-center gap-1 text-sm text-foreground-muted mt-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {[property.address_line_1, property.address_line_2, property.postcode, property.area]
                .filter(Boolean)
                .join(", ")}
              {property.nearest_tube_station && ` · Near ${property.nearest_tube_station}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/properties/${property.id}/setup`}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-card px-4 py-2 text-sm font-medium text-foreground-secondary hover:bg-surface-inset hover:text-foreground transition-colors"
          >
            Manage rooms
          </Link>
          <Link
            href={`/properties/${property.id}/edit`}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-card px-4 py-2 text-sm font-medium text-foreground-secondary hover:bg-surface-inset hover:text-foreground transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
          <DeletePropertyButton
            propertyId={property.id}
            propertyName={property.name}
            redirectAfter
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border flex gap-0">
        {[
          { value: "overview" as const, label: "Overview" },
          { value: "tenants" as const, label: "Tenants", icon: Users },
          ...(keysEnabled
            ? [{ value: "keys" as const, label: "Keys", icon: KeyIcon }]
            : []),
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5",
                activeTab === tab.value
                  ? "border-brand text-brand"
                  : "border-transparent text-foreground-secondary hover:text-foreground hover:border-border"
              )}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "tenants" && (
        <PropertyTenantHistory history={tenantHistory} canCloseout={canCloseout} />
      )}

      {activeTab === "keys" && keysEnabled && keysPayload && (
        <PropertyKeysTab
          payload={keysPayload}
          units={units.map((u) => ({
            id: u.id,
            label: u.room_number
              ? `Room ${u.room_number}`
              : u.unit_type === "studio"
              ? "Studio"
              : "Whole flat",
          }))}
          agents={agents}
        />
      )}

      {activeTab === "overview" && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ── Left: photos + rooms ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Communal photos */}
          <div className="rounded-bento bg-surface-card shadow-bento p-6 space-y-5">
            <div className="flex items-center gap-3 pb-1 border-b border-border">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                <ImageIcon className="h-4 w-4 text-brand" strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Common area photos</h2>
                <p className="text-xs text-foreground-muted">{communalPhotos.length} photo{communalPhotos.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {hasCommunalPhotos ? (
              <div className="space-y-5">
                {COMMUNAL_ORDER.filter((cat) => communalByCategory[cat].length > 0).map((cat) => (
                  <div key={cat} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted capitalize">{cat}</p>
                    <PhotoGrid photos={communalByCategory[cat]} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center text-foreground-muted rounded-xl border border-dashed border-border bg-surface-inset">
                <ImageIcon className="h-7 w-7 mb-2 opacity-30" />
                <p className="text-sm">No common area photos yet</p>
                <Link
                  href={`/properties/${property.id}/setup`}
                  className="mt-2 text-xs text-brand hover:underline"
                >
                  Add photos on the setup page →
                </Link>
              </div>
            )}
          </div>

          {/* Rooms */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                Rooms
                <span className="ml-2 text-sm font-normal text-foreground-muted">({units.length})</span>
              </h2>
              <Link
                href={`/properties/${property.id}/setup`}
                className="text-xs text-brand hover:underline"
              >
                Manage rooms →
              </Link>
            </div>

            {units.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface-card py-12 text-center">
                <DoorOpen className="h-8 w-8 text-foreground-muted mx-auto mb-2 opacity-40" strokeWidth={1.5} />
                <p className="text-sm text-foreground-muted">No rooms yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {units.map((unit) => (
                  <RoomCard
                    key={unit.id}
                    unit={unit}
                    photos={photosByUnit[unit.id] ?? []}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: property info ── */}
        <div className="lg:col-span-1 lg:sticky lg:top-6 space-y-4">

          {/* Key stats */}
          <div className="rounded-bento bg-surface-card shadow-bento p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Overview</p>

            <div className="grid grid-cols-2 gap-3">
              {property.total_rooms && (
                <div className="rounded-xl bg-surface-inset border border-border px-3 py-2.5 text-center">
                  <p className="text-xl font-bold text-foreground">{property.total_rooms}</p>
                  <p className="text-[10px] text-foreground-muted mt-0.5">Total rooms</p>
                </div>
              )}
              {property.total_bathrooms && (
                <div className="rounded-xl bg-surface-inset border border-border px-3 py-2.5 text-center">
                  <p className="text-xl font-bold text-foreground">{property.total_bathrooms}</p>
                  <p className="text-[10px] text-foreground-muted mt-0.5">Bathrooms</p>
                </div>
              )}
              <div className="rounded-xl bg-surface-inset border border-border px-3 py-2.5 text-center">
                <p className="text-xl font-bold text-foreground">
                  {units.filter((u) => u.status === "available").length}
                </p>
                <p className="text-[10px] text-foreground-muted mt-0.5">Available</p>
              </div>
              <div className="rounded-xl bg-surface-inset border border-border px-3 py-2.5 text-center">
                <p className="text-xl font-bold text-foreground">
                  {units.filter((u) => u.status === "occupied").length}
                </p>
                <p className="text-[10px] text-foreground-muted mt-0.5">Occupied</p>
              </div>
            </div>

            {/* Bills */}
            {property.bills && (
              <div className="flex items-center gap-2 rounded-xl bg-surface-inset border border-border px-3 py-2.5">
                <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">{BILLS_LABEL[property.bills] ?? property.bills}</p>
                  {property.bills_notes && (
                    <p className="text-[10px] text-foreground-muted mt-0.5">{property.bills_notes}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Amenities */}
          <div className="rounded-bento bg-surface-card shadow-bento p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Amenities</p>
            <div className="grid grid-cols-2 gap-2">
              {AMENITIES.map(({ key, label, icon }) => (
                <AmenityChip key={key} icon={icon} label={label} active={!!property[key]} />
              ))}
            </div>
          </div>

          {/* Tenant preferences */}
          {(property.preferred_occupation !== "any" ||
            property.preferred_gender !== "any" ||
            property.min_age ||
            property.max_age) && (
            <div className="rounded-bento bg-surface-card shadow-bento p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Tenant preferences
              </p>
              <div className="flex flex-wrap gap-2">
                {property.preferred_occupation !== "any" && (
                  <span className="rounded-lg bg-surface-inset border border-border px-2.5 py-1 text-xs font-medium text-foreground-secondary capitalize">
                    {property.preferred_occupation}
                  </span>
                )}
                {property.preferred_gender !== "any" && (
                  <span className="rounded-lg bg-surface-inset border border-border px-2.5 py-1 text-xs font-medium text-foreground-secondary capitalize">
                    {property.preferred_gender}
                  </span>
                )}
                {(property.min_age || property.max_age) && (
                  <span className="rounded-lg bg-surface-inset border border-border px-2.5 py-1 text-xs font-medium text-foreground-secondary">
                    Age {property.min_age ?? "any"}–{property.max_age ?? "any"}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

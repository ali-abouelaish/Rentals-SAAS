"use client";

import Link from "next/link";
import { differenceInDays, parseISO } from "date-fns";
import { MapPin, Clock, User, Warehouse, Pencil, Key } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { UnitStatusBadge } from "./UnitStatusBadge";
import { PortfolioBadge } from "./PortfolioBadge";
import { AddRoomDialog } from "./AddRoomDialog";
import { DeletePropertyButton } from "./DeletePropertyButton";
import type { Property, Unit } from "../domain/types";

function formatPrice(min: number | null, max: number | null): string {
  if (!min && !max) return "—";
  if (min && max && min !== max) return `£${min.toLocaleString()}–£${max.toLocaleString()}`;
  return `£${(max ?? min)!.toLocaleString()}`;
}

function formatUnitLabel(unit: Unit): string {
  if (unit.unit_type === "room") {
    const roomLabel = unit.room_type
      ? unit.room_type.charAt(0).toUpperCase() + unit.room_type.slice(1)
      : "Room";
    return unit.room_number ? `Room ${unit.room_number} · ${roomLabel}` : roomLabel;
  }
  if (unit.unit_type === "studio") return "Studio";
  return "Whole Flat";
}

function getDaysEmpty(unit: Unit): number | null {
  if (!["available", "move_out", "replacement"].includes(unit.status)) return null;
  if (!unit.available_date) return null;
  try {
    const days = differenceInDays(new Date(), parseISO(unit.available_date));
    return days >= 0 ? days : null;
  } catch {
    return null;
  }
}

function formatPropertyType(type: string) {
  if (type === "hmo") return "HMO";
  if (type === "studio") return "Studio";
  return "Whole Flat";
}

/* Column layout shared between header and rows */
const COLS = "grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_80px]";

function UnitRow({
  unit,
  onUnitClick,
  striped,
}: {
  unit: Unit;
  onUnitClick: (id: string) => void;
  striped: boolean;
}) {
  const daysEmpty = getDaysEmpty(unit);
  return (
    <button
      type="button"
      onClick={() => onUnitClick(unit.id)}
      className={cn(
        COLS,
        "w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-inset",
        striped && "bg-surface-inset/40"
      )}
    >
      {/* Unit label */}
      <div className="flex items-center min-w-0 pl-5 border-l-2 border-border">
        <span className="text-sm font-medium text-foreground">{formatUnitLabel(unit)}</span>
      </div>

      {/* Status */}
      <div className="flex items-center">
        <UnitStatusBadge status={unit.status} size="sm" />
      </div>

      {/* Available date */}
      <div className="flex items-center">
        {unit.available_date ? (
          <span className="text-xs text-foreground-secondary">
            {new Date(unit.available_date).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })}
          </span>
        ) : (
          <span className="text-xs text-foreground-muted">—</span>
        )}
      </div>

      {/* Price */}
      <div className="flex items-center">
        <span className="text-sm font-medium text-foreground tabular-nums">
          {formatPrice(unit.min_price_pcm, unit.max_price_pcm)}
        </span>
      </div>

      {/* Tenant */}
      <div className="flex items-center min-w-0">
        {unit.resident ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="h-5 w-5 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <User className="h-3 w-3 text-brand" />
            </div>
            <span className="text-xs text-foreground truncate">{unit.resident.full_name}</span>
          </div>
        ) : (
          <span className="text-xs text-foreground-muted">Vacant</span>
        )}
      </div>

      {/* Days empty */}
      <div className="flex items-center justify-center">
        {daysEmpty !== null ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
              daysEmpty === 0
                ? "bg-green-50 text-green-700"
                : daysEmpty <= 7
                ? "bg-amber-50 text-amber-700"
                : daysEmpty <= 30
                ? "bg-orange-50 text-orange-700"
                : "bg-red-50 text-red-700"
            )}
          >
            <Clock className="h-2.5 w-2.5" />
            {daysEmpty}d
          </span>
        ) : (
          <span className="text-xs text-foreground-muted">—</span>
        )}
      </div>

      {/* empty last cell */}
      <div />
    </button>
  );
}

function PropertyGroup({
  property,
  units,
  onUnitClick,
  onUnitCreated,
  onPropertyDeleted,
}: {
  property: Property;
  units: Unit[];
  onUnitClick: (id: string) => void;
  onUnitCreated: (unit: Unit) => void;
  onPropertyDeleted: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
      {/* Property header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-inset/60 border-b border-border">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10">
          <Warehouse className="h-4 w-4 text-brand" strokeWidth={1.8} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/properties/${property.id}`}
              className="text-sm font-semibold text-foreground hover:text-brand hover:underline transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {property.name}
            </Link>
            <span className="rounded-full bg-surface-card border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground-muted uppercase tracking-wide">
              {formatPropertyType(property.property_type)}
            </span>
            {property.portfolio && <PortfolioBadge portfolio={property.portfolio} />}
            {property.owner_landlord && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                <Key className="h-2.5 w-2.5" />
                {property.owner_landlord.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-foreground-muted mt-0.5">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {property.address_line_1}
              {property.postcode && `, ${property.postcode}`}
              {property.area && ` · ${property.area}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <span className="text-xs text-foreground-muted mr-1">
            {units.length} {units.length === 1 ? "unit" : "units"}
          </span>
          <AddRoomDialog property={property} onCreated={onUnitCreated} />
          <Link
            href={`/properties/${property.id}/edit`}
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-surface-inset hover:bg-surface-card transition-colors text-foreground-muted hover:text-foreground"
            title="Edit property"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          <DeletePropertyButton
            propertyId={property.id}
            propertyName={property.name}
            onDeleted={() => onPropertyDeleted(property.id)}
          />
        </div>
      </div>

      {/* Column header (only when there are units) */}
      {units.length > 0 && (
        <div className={cn(COLS, "gap-3 px-4 py-2 border-b border-border/50 bg-surface-inset/30")}>
          <div className="pl-5 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Unit</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Status</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Available</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Price PCM</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Tenant</div>
          <div className="col-span-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted text-center">Empty</div>
        </div>
      )}

      {/* Unit rows */}
      {units.length > 0 ? (
        <div className="divide-y divide-border">
          {units.map((unit, i) => (
            <UnitRow key={unit.id} unit={unit} onUnitClick={onUnitClick} striped={i % 2 === 1} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 py-6 text-center">
          <p className="text-sm text-foreground-muted">No rooms yet</p>
          <AddRoomDialog property={property} onCreated={onUnitCreated} />
        </div>
      )}
    </div>
  );
}

interface UnitsListViewProps {
  properties: Property[];
  units: Unit[];
  onUnitClick: (unitId: string) => void;
  onUnitCreated: (unit: Unit) => void;
  onPropertyDeleted: (propertyId: string) => void;
}

export function UnitsListView({ properties, units, onUnitClick, onUnitCreated, onPropertyDeleted }: UnitsListViewProps) {
  if (properties.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-card py-16 text-center">
        <Warehouse className="h-10 w-10 text-foreground-muted mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-foreground mb-1">No properties found</p>
        <p className="text-xs text-foreground-secondary">Try adjusting your filters or add a new property</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {properties.map((property) => {
        const propertyUnits = units.filter((u) => u.property_id === property.id);
        return (
          <PropertyGroup
            key={property.id}
            property={property}
            units={propertyUnits}
            onUnitClick={onUnitClick}
            onUnitCreated={onUnitCreated}
            onPropertyDeleted={onPropertyDeleted}
          />
        );
      })}
    </div>
  );
}

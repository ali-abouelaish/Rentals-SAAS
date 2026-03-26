"use client";

import { differenceInDays, parseISO } from "date-fns";
import { MapPin, Clock, User, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { UnitStatusBadge } from "./UnitStatusBadge";
import { PortfolioBadge } from "./PortfolioBadge";
import type { Unit } from "../domain/types";

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

interface UnitsListViewProps {
  units: Unit[];
  onUnitClick: (unitId: string) => void;
}

export function UnitsListView({ units, onUnitClick }: UnitsListViewProps) {
  if (units.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
        <MapPin className="h-10 w-10 text-foreground-muted mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">No units found</p>
        <p className="text-xs text-foreground-secondary">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1fr_80px] gap-3 px-4 py-2.5 bg-brand text-brand-fg text-xs font-semibold uppercase tracking-wide">
        <div>Portfolio / Property</div>
        <div>Unit</div>
        <div>Status</div>
        <div>Available</div>
        <div>Price PCM</div>
        <div>Tenant</div>
        <div className="text-center">Empty</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {units.map((unit, i) => {
          const daysEmpty = getDaysEmpty(unit);
          const portfolio = unit.property?.portfolio;

          return (
            <button
              key={unit.id}
              type="button"
              onClick={() => onUnitClick(unit.id)}
              className={cn(
                "grid w-full grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1fr_80px] gap-3 px-4 py-3 text-left",
                "transition-colors hover:bg-surface-inset group",
                i % 2 === 1 && "bg-surface-inset/40"
              )}
            >
              {/* Portfolio + Property */}
              <div className="flex flex-col gap-0.5 min-w-0">
                {portfolio && <PortfolioBadge portfolio={portfolio} />}
                <span className="text-xs text-foreground-secondary truncate mt-0.5">
                  {unit.property?.address_line_1 ?? "—"}
                </span>
                {unit.property?.area && (
                  <span className="flex items-center gap-0.5 text-[10px] text-foreground-muted">
                    <MapPin className="h-2.5 w-2.5" />
                    {unit.property.area}
                  </span>
                )}
              </div>

              {/* Unit label */}
              <div className="flex flex-col gap-0.5 min-w-0 justify-center">
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
                      year: "numeric",
                    })}
                  </span>
                ) : (
                  <span className="text-xs text-foreground-muted">—</span>
                )}
              </div>

              {/* Price */}
              <div className="flex items-center">
                <span className="text-sm font-medium text-foreground">
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
            </button>
          );
        })}
      </div>
    </div>
  );
}

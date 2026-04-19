"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { differenceInDays, parseISO } from "date-fns";
import { MapPin, Clock, User, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PortfolioBadge } from "./PortfolioBadge";
import type { Unit } from "../domain/types";

function formatPrice(min: number | null, max: number | null): string {
  if (!min && !max) return "";
  if (min && max && min !== max) return `£${min.toLocaleString()}–${max.toLocaleString()}`;
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

interface KanbanCardProps {
  unit: Unit;
  onClick: (unitId: string) => void;
  isDragging?: boolean;
}

export function KanbanCard({ unit, onClick, isDragging: isDraggingProp }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: unit.id,
    data: { unit },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const portfolio = unit.property?.portfolio;
  const daysEmpty = getDaysEmpty(unit);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-xl border border-border bg-surface-card p-3 shadow-xs",
        "transition-all duration-150",
        (isDragging || isDraggingProp)
          ? "opacity-50 shadow-lg rotate-1 scale-105 z-50 cursor-grabbing"
          : "hover:shadow-sm hover:-translate-y-0.5 cursor-pointer"
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 p-1 text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Card body — clickable for drawer */}
      <div
        onClick={() => !isDragging && onClick(unit.id)}
        className="space-y-2"
      >
        {/* Portfolio badge */}
        {portfolio && <PortfolioBadge portfolio={portfolio} />}

        {/* Property name */}
        <div>
          <p className="text-xs text-foreground-secondary leading-tight truncate">
            {unit.property?.address_line_1}
          </p>
          <p className="text-sm font-semibold text-foreground leading-tight">
            {formatUnitLabel(unit)}
          </p>
        </div>

        {/* Price */}
        {(unit.min_price_pcm || unit.max_price_pcm) && (
          <p className="text-xs font-medium text-foreground-secondary">
            {formatPrice(unit.min_price_pcm, unit.max_price_pcm)}
            <span className="text-foreground-muted font-normal"> /mo</span>
          </p>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between gap-2">
          {unit.available_date && (
            <span className="flex items-center gap-0.5 text-[10px] text-foreground-muted">
              <MapPin className="h-2.5 w-2.5" />
              {new Date(unit.available_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          )}

          {(unit.pm_tenant || unit.resident) && (
            <span className="flex items-center gap-1 text-[10px] text-foreground-muted ml-auto">
              <User className="h-2.5 w-2.5" />
              <span className="truncate max-w-[80px]">
                {unit.pm_tenant?.full_name ?? unit.resident?.full_name}
              </span>
            </span>
          )}
        </div>

        {/* Days empty */}
        {daysEmpty !== null && (
          <div className="mt-1">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                daysEmpty === 0 ? "bg-green-50 text-green-700" :
                daysEmpty <= 7 ? "bg-amber-50 text-amber-700" :
                daysEmpty <= 30 ? "bg-orange-50 text-orange-700" :
                "bg-red-50 text-red-700"
              )}
            >
              <Clock className="h-2.5 w-2.5" />
              {daysEmpty === 0 ? "Today" : `${daysEmpty}d empty`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils/cn";
import { KanbanCard } from "./KanbanCard";
import { STATUS_CONFIG, type Unit, type UnitStatus } from "../domain/types";

interface KanbanColumnProps {
  status: UnitStatus;
  units: Unit[];
  onCardClick: (unitId: string) => void;
  isOver?: boolean;
}

export function KanbanColumn({ status, units, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex flex-col w-[240px] shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", config.dot)} />
          <span className="text-xs font-semibold text-foreground">{config.label}</span>
        </div>
        <span className="text-xs text-foreground-muted bg-surface-inset rounded-full px-1.5 py-0.5">
          {units.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-2 min-h-[120px] rounded-xl p-2 transition-colors duration-150",
          isOver
            ? "bg-brand/5 border-2 border-dashed border-brand/40"
            : "bg-surface-inset/60 border-2 border-dashed border-transparent"
        )}
      >
        {units.map((unit) => (
          <KanbanCard key={unit.id} unit={unit} onClick={onCardClick} />
        ))}

        {units.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-6">
            <p className="text-xs text-foreground-muted">Drop here</p>
          </div>
        )}
      </div>
    </div>
  );
}

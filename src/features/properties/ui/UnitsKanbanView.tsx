"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { StatusPickerDialog } from "./StatusPickerDialog";
import { UNIT_STATUSES, type Unit, type UnitStatus } from "../domain/types";

interface UnitsKanbanViewProps {
  units: Unit[];
  onUnitClick: (unitId: string) => void;
  onUnitsChange: (updated: Unit[]) => void;
}

export function UnitsKanbanView({ units, onUnitClick, onUnitsChange }: UnitsKanbanViewProps) {
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    unitId: string;
    fromStatus: UnitStatus;
    toStatus: UnitStatus;
  } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const unitsByStatus = UNIT_STATUSES.reduce<Record<UnitStatus, Unit[]>>((acc, s) => {
    acc[s] = units.filter((u) => u.status === s);
    return acc;
  }, {} as Record<UnitStatus, Unit[]>);

  const handleDragStart = (event: DragStartEvent) => {
    const unit = units.find((u) => u.id === event.active.id);
    if (unit) setActiveUnit(unit);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveUnit(null);
    const { active, over } = event;
    if (!over) return;

    const draggedUnit = units.find((u) => u.id === active.id);
    if (!draggedUnit) return;

    const toStatus = over.id as UnitStatus;
    if (!UNIT_STATUSES.includes(toStatus)) return;
    if (draggedUnit.status === toStatus) return;

    setPendingMove({
      unitId: draggedUnit.id,
      fromStatus: draggedUnit.status,
      toStatus,
    });
  };

  const pendingUnit = pendingMove ? units.find((u) => u.id === pendingMove.unitId) ?? null : null;

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
          {UNIT_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              units={unitsByStatus[status]}
              onCardClick={onUnitClick}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeUnit && (
            <KanbanCard unit={activeUnit} onClick={() => {}} isDragging />
          )}
        </DragOverlay>
      </DndContext>

      {pendingMove && (
        <StatusPickerDialog
          open
          onClose={() => setPendingMove(null)}
          unitId={pendingMove.unitId}
          currentStatus={pendingMove.fromStatus}
          currentAvailableDate={pendingUnit?.available_date ?? null}
          initialTarget={pendingMove.toStatus}
          onChanged={(change) => {
            // Optimistically update local state; server revalidation will sync
            onUnitsChange(
              units.map((u) =>
                u.id === change.id
                  ? { ...u, status: change.status, available_date: change.available_date }
                  : u
              )
            );
            setPendingMove(null);
          }}
        />
      )}
    </>
  );
}

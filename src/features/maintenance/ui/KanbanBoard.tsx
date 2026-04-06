"use client";

import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
  MouseSensor,
  TouchSensor,
  useSensors,
  useSensor,
} from "@dnd-kit/core";
import {
  Wrench,
  GripVertical,
  CalendarDays,
  User,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { MaintenanceJob, JobStatus } from "../domain/types";
import {
  KANBAN_COLUMNS,
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  JOB_PRIORITY_COLORS,
  JOB_CATEGORY_LABELS,
  JOB_PRIORITY_LABELS,
} from "../domain/types";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function fmtPounds(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

// ──────────────────────────────────────────────────────────
// Draggable Job Card
// ──────────────────────────────────────────────────────────

interface KanbanCardProps {
  job: MaintenanceJob;
  onJobClick: (job: MaintenanceJob) => void;
}

function KanbanCard({ job, onJobClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform } =
    useDraggable({ id: job.id, data: { status: job.status } });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 1000 }
    : undefined;

  const pColors = JOB_PRIORITY_COLORS[job.priority];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-surface-card rounded-xl border border-border p-3 shadow-sm select-none",
        isDragging ? "opacity-40 shadow-xl ring-2 ring-brand/30" : "cursor-pointer hover:border-brand/30 transition-colors"
      )}
      onClick={() => !isDragging && onJobClick(job)}
    >
      {/* Drag handle + priority dot */}
      <div className="flex items-start gap-2 mb-2">
        <button
          {...listeners}
          {...attributes}
          className="mt-0.5 text-foreground-muted hover:text-foreground transition-colors cursor-grab active:cursor-grabbing shrink-0"
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to move"
        >
          <GripVertical size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                pColors.bg, pColors.text, pColors.border
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", pColors.dot)} />
              {JOB_PRIORITY_LABELS[job.priority]}
            </span>
            <span className="text-[10px] text-foreground-muted">{JOB_CATEGORY_LABELS[job.category]}</span>
          </div>
          <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{job.title}</p>
        </div>
      </div>

      {/* Property + unit */}
      <p className="text-xs text-foreground-secondary truncate flex items-center gap-1 mb-2">
        <Wrench size={11} className="shrink-0" />
        {job.property_name}
        {job.unit_label && <span className="text-foreground-muted">· {job.unit_label}</span>}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[11px] text-foreground-muted">
        {job.assigned_to && (
          <span className="flex items-center gap-1 truncate">
            <User size={10} />
            <span className="truncate">{job.assigned_to}</span>
          </span>
        )}
        {job.scheduled_date && (
          <span className="flex items-center gap-1 shrink-0">
            <CalendarDays size={10} />
            {new Date(job.scheduled_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
        )}
        {job.total_cost > 0 && (
          <span className="flex items-center gap-1 ml-auto shrink-0 text-emerald-700 font-medium">
            <DollarSign size={10} />
            {fmtPounds(job.total_cost)}
          </span>
        )}
        {!job.assigned_to && !job.scheduled_date && !job.total_cost && (
          <span className="ml-auto">{daysAgo(job.created_at)}</span>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Droppable Column
// ──────────────────────────────────────────────────────────

interface KanbanColumnProps {
  status: JobStatus;
  jobs: MaintenanceJob[];
  onJobClick: (job: MaintenanceJob) => void;
}

function KanbanColumn({ status, jobs, onJobClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const sColors = JOB_STATUS_COLORS[status];

  return (
    <div className="flex flex-col min-w-[260px] max-w-[300px]">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className={cn("text-xs font-semibold uppercase tracking-wider", sColors.text)}>
          {JOB_STATUS_LABELS[status]}
        </span>
        <span
          className={cn(
            "text-[11px] font-medium rounded-full px-2 py-0.5",
            sColors.bg, sColors.text
          )}
        >
          {jobs.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-2 min-h-[120px] rounded-xl p-2 transition-colors",
          isOver ? "bg-brand/5 ring-2 ring-brand/20" : "bg-surface-inset"
        )}
      >
        {jobs.map((job) => (
          <KanbanCard key={job.id} job={job} onJobClick={onJobClick} />
        ))}
        {jobs.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-8 text-xs text-foreground-muted">
            No jobs here
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Main KanbanBoard
// ──────────────────────────────────────────────────────────

interface KanbanBoardProps {
  jobs: MaintenanceJob[];
  onJobClick: (job: MaintenanceJob) => void;
  onStatusChange: (jobId: string, newStatus: string) => void;
}

export function KanbanBoard({ jobs, onJobClick, onStatusChange }: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const currentStatus = (active.data.current as { status: string })?.status;
    const newStatus = String(over.id);
    if (currentStatus && currentStatus !== newStatus) {
      onStatusChange(String(active.id), newStatus);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
        {KANBAN_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            jobs={jobs.filter((j) => j.status === status)}
            onJobClick={onJobClick}
          />
        ))}
      </div>
    </DndContext>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { STATUS_CONFIG, type UnitStatus } from "../domain/types";
import { StatusPickerDialog, type UnitStatusChange } from "./StatusPickerDialog";

interface UnitStatusControlProps {
  unitId: string;
  status: UnitStatus;
  availableDate?: string | null;
  onChanged: (change: UnitStatusChange) => void;
  size?: "sm" | "md";
  className?: string;
}

/**
 * The unit status badge, made interactive: one tap opens a touch-friendly
 * picker to change status (and its date/reason) from anywhere the badge shows.
 */
export function UnitStatusControl({
  unitId,
  status,
  availableDate,
  onChanged,
  size = "sm",
  className,
}: UnitStatusControlProps) {
  const [open, setOpen] = useState(false);
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  return (
    <>
      <button
        type="button"
        title="Change status"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full font-medium border border-transparent",
          "select-none caret-transparent transition-all hover:ring-2 hover:ring-brand/25 active:scale-[0.97] cursor-pointer",
          size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
          config.bg,
          config.fg,
          className
        )}
      >
        <span className={cn("rounded-full shrink-0", config.dot, size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2")} />
        {config.label}
        <ChevronDown className={cn("shrink-0 opacity-60", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      </button>

      <StatusPickerDialog
        open={open}
        onClose={() => setOpen(false)}
        unitId={unitId}
        currentStatus={status}
        currentAvailableDate={availableDate ?? null}
        onChanged={onChanged}
      />
    </>
  );
}

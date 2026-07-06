"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { updateUnitStatus } from "../actions/units";
import { STATUS_CONFIG, UNIT_STATUSES, type UnitStatus } from "../domain/types";
import { toast } from "sonner";

export interface UnitStatusChange {
  id: string;
  status: UnitStatus;
  available_date: string | null;
}

interface StatusPickerDialogProps {
  open: boolean;
  onClose: () => void;
  unitId: string;
  currentStatus: UnitStatus;
  currentAvailableDate?: string | null;
  /** Pre-select a target status (used by the Kanban drag-and-drop flow). */
  initialTarget?: UnitStatus;
  onChanged: (change: UnitStatusChange) => void;
}

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

/** Copy shown for the extra field each status needs. */
const DATE_FIELD: Partial<Record<UnitStatus, { label: string; hint: string }>> = {
  booked: { label: "Move-in date", hint: "When the tenant moves in — optional if not confirmed yet." },
  move_out: { label: "Available from", hint: "The date the unit is free to re-let." },
  replacement: { label: "Expected available date", hint: "Best estimate of when it will be free." },
  on_hold: { label: "Hold until", hint: "Optional — when the hold is expected to lift." },
};

export function StatusPickerDialog({
  open,
  onClose,
  unitId,
  currentStatus,
  currentAvailableDate,
  initialTarget,
  onChanged,
}: StatusPickerDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<UnitStatus>(initialTarget ?? currentStatus);
  const [availableDate, setAvailableDate] = useState(currentAvailableDate ?? "");
  const [holdReason, setHoldReason] = useState("");

  // Reset local state each time the dialog is opened.
  useEffect(() => {
    if (open) {
      setSelected(initialTarget ?? currentStatus);
      setAvailableDate(currentAvailableDate ?? "");
      setHoldReason("");
    }
  }, [open, initialTarget, currentStatus, currentAvailableDate]);

  const dateField = DATE_FIELD[selected];
  const unchanged = selected === currentStatus && (availableDate || "") === (currentAvailableDate ?? "");

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        await updateUnitStatus(unitId, {
          status: selected,
          available_date: availableDate || undefined,
          notice_given: selected === "move_out" ? true : undefined,
          hold_reason: selected === "on_hold" ? holdReason || undefined : undefined,
        });
        onChanged({ id: unitId, status: selected, available_date: availableDate || null });
        toast.success(`Status set to ${STATUS_CONFIG[selected].label}`);
        onClose();
      } catch {
        toast.error("Failed to update status");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg">Change status</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status chips — large tap targets, two-up on mobile */}
          <div className="grid grid-cols-2 gap-2">
            {UNIT_STATUSES.map((s) => {
              const c = STATUS_CONFIG[s];
              const isSelected = selected === s;
              const isCurrent = currentStatus === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelected(s)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium text-left transition-all",
                    isSelected
                      ? "border-brand ring-2 ring-brand/20 bg-brand/5 text-foreground"
                      : "border-border text-foreground-secondary hover:border-brand/50 hover:bg-surface-inset"
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", c.dot)} />
                  <span className="truncate">{c.label}</span>
                  {isCurrent && (
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
                      Now
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Status-specific field */}
          {dateField && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">{dateField.label}</label>
              <input
                type="date"
                value={availableDate}
                onChange={(e) => setAvailableDate(e.target.value)}
                className={inputCls}
              />
              <p className="text-xs text-foreground-muted">{dateField.hint}</p>
            </div>
          )}

          {selected === "on_hold" && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Reason for hold</label>
              <input
                type="text"
                placeholder="e.g. Awaiting references"
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                className={inputCls}
              />
              <p className="text-xs text-foreground-muted">Optional — a short note on why it's held.</p>
            </div>
          )}

          {selected === "renewal" && (
            <p className="text-sm text-foreground-secondary">
              Manage the contract renewal in the Contracts module after saving.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleConfirm}
            loading={isPending}
            disabled={unchanged}
          >
            {unchanged ? "No change" : `Set to ${STATUS_CONFIG[selected].label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

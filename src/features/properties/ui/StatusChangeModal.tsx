"use client";

import { useState, useTransition } from "react";
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
import { STATUS_CONFIG, type UnitStatus } from "../domain/types";
import { toast } from "sonner";

interface StatusChangeModalProps {
  open: boolean;
  onClose: () => void;
  unitId: string;
  fromStatus: UnitStatus;
  toStatus: UnitStatus;
  onSuccess: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

export function StatusChangeModal({
  open,
  onClose,
  unitId,
  fromStatus,
  toStatus,
  onSuccess,
}: StatusChangeModalProps) {
  const [isPending, startTransition] = useTransition();
  const [availableDate, setAvailableDate] = useState("");
  const [holdReason, setHoldReason] = useState("");

  const toConfig = STATUS_CONFIG[toStatus];

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        await updateUnitStatus(unitId, {
          status: toStatus,
          available_date: availableDate || undefined,
          notice_given: toStatus === "move_out" ? true : undefined,
          hold_reason: holdReason || undefined,
        });
        toast.success(`Status updated to ${toConfig.label}`);
        onSuccess();
        onClose();
      } catch (e) {
        toast.error("Failed to update status");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Move to{" "}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-semibold",
                toConfig.bg,
                toConfig.fg
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", toConfig.dot)} />
              {toConfig.label}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {toStatus === "booked" && (
            <Field label="Move-in date">
              <input
                type="date"
                value={availableDate}
                onChange={(e) => setAvailableDate(e.target.value)}
                className={inputCls}
              />
            </Field>
          )}

          {toStatus === "on_hold" && (
            <>
              <Field label="Reason for hold">
                <input
                  type="text"
                  placeholder="e.g. Awaiting references"
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Hold until">
                <input
                  type="date"
                  value={availableDate}
                  onChange={(e) => setAvailableDate(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </>
          )}

          {toStatus === "move_out" && (
            <Field label="Available from">
              <input
                type="date"
                value={availableDate}
                onChange={(e) => setAvailableDate(e.target.value)}
                className={inputCls}
              />
            </Field>
          )}

          {toStatus === "renewal" && (
            <p className="text-sm text-foreground-secondary">
              Confirm moving this unit to <strong>{toConfig.label}</strong>? Manage the contract renewal in the Contracts module.
            </p>
          )}

          {toStatus === "replacement" && (
            <Field label="Expected available date">
              <input
                type="date"
                value={availableDate}
                onChange={(e) => setAvailableDate(e.target.value)}
                className={inputCls}
              />
            </Field>
          )}

          {(toStatus === "available" || toStatus === "occupied") && (
            <p className="text-sm text-foreground-secondary">
              Confirm moving this unit to <strong>{toConfig.label}</strong>?
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={handleConfirm} loading={isPending}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { giveNotice } from "../actions/contracts";

interface GiveNoticeModalProps {
  contractId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const inputCls = "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

export function GiveNoticeModal({ contractId, open, onClose, onSuccess }: GiveNoticeModalProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [noticeGivenBy, setNoticeGivenBy] = useState<"tenant" | "landlord">("tenant");
  const [noticeGivenDate, setNoticeGivenDate] = useState(today);
  const [vacateDate, setVacateDate] = useState(format(addDays(new Date(), 60), "yyyy-MM-dd"));
  const [isPending, startTransition] = useTransition();

  // Auto-update vacate date when notice date changes
  const handleNoticeDateChange = (date: string) => {
    setNoticeGivenDate(date);
    if (date) {
      setVacateDate(format(addDays(new Date(date), 60), "yyyy-MM-dd"));
    }
  };

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        await giveNotice(contractId, {
          notice_given_by: noticeGivenBy,
          notice_given_date: noticeGivenDate,
          vacate_date: vacateDate,
        });
        toast.success("Notice recorded — unit set to Move Out");
        onSuccess();
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to record notice");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Give Notice</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Field label="Who gave notice?">
            <div className="flex gap-2">
              {(["tenant", "landlord"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setNoticeGivenBy(v)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    noticeGivenBy === v
                      ? "bg-brand text-brand-fg border-brand"
                      : "border-border text-foreground-secondary hover:bg-surface-inset"
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Notice given date">
            <input
              type="date"
              value={noticeGivenDate}
              onChange={(e) => handleNoticeDateChange(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Vacate date (auto = notice date + 60 days)">
            <input
              type="date"
              value={vacateDate}
              onChange={(e) => setVacateDate(e.target.value)}
              className={inputCls}
            />
          </Field>

          <p className="text-xs text-foreground-muted rounded-lg bg-surface-inset p-3 border border-border">
            This will set the contract to <strong>Notice Given</strong> and update the unit status to <strong>Move Out</strong>.
            The available date on the unit will be set to the vacate date.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={handleConfirm} loading={isPending}>
            Confirm Notice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

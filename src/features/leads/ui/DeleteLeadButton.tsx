"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteLead } from "../actions/leads";

interface Props {
  leadId: string;
  leadName: string;
}

export function DeleteLeadButton({ leadId, leadName }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        await deleteLead(leadId);
      } catch {
        toast.error("Failed to delete lead");
        setOpen(false);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-status-error-border bg-transparent px-3 py-2 text-sm font-medium text-status-error-fg hover:bg-status-error-bg transition-colors"
      >
        <Trash2 className="h-4 w-4" />
        Delete lead
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-bento bg-surface-card shadow-bento p-6 space-y-4 mx-4">
            <h3 className="text-base font-semibold text-foreground">Delete lead</h3>
            <p className="text-sm text-foreground-muted">
              Are you sure you want to permanently delete the lead from{" "}
              <strong>{leadName}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="rounded-lg px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-lg bg-status-error-fg px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {isPending ? "Deleting…" : "Delete lead"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

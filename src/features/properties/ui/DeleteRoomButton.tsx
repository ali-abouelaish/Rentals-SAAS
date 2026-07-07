"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteUnit } from "../actions/units";

interface Props {
  unitId: string;
  roomLabel: string;
  /** Called after successful deletion so the parent can drop the card from state */
  onDeleted: (unitId: string) => void;
}

const IS_DEV = process.env.NODE_ENV !== "production";

export function DeleteRoomButton({ unitId, roomLabel, onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = (force = false) => {
    startTransition(async () => {
      try {
        const result = await deleteUnit(unitId, { force });
        if (!result.ok) {
          if (result.blockedByHistory && IS_DEV) {
            // Offer the dev-only force path instead of just failing.
            setBlocked(result.error);
            return;
          }
          toast.error("Can't delete room", { description: result.error });
          setOpen(false);
          return;
        }
        toast.success(force ? "Room force-deleted" : "Room deleted");
        setOpen(false);
        setBlocked(null);
        onDeleted(unitId);
      } catch (err) {
        toast.error("Failed to delete room", {
          description: err instanceof Error ? err.message : "Something went wrong.",
        });
        setOpen(false);
      }
    });
  };

  const closeDialog = () => {
    setOpen(false);
    setBlocked(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center h-8 w-8 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
        title="Delete room"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-bento bg-surface-card shadow-bento p-6 space-y-4 mx-4">
            <h3 className="text-base font-semibold text-foreground">Delete room</h3>
            {blocked ? (
              <>
                <p className="text-sm text-foreground-muted">{blocked}</p>
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5">
                  <p className="text-xs font-medium text-red-700">
                    Dev override — force delete <strong>{roomLabel}</strong> and cascade-delete its
                    contracts, rent payments and photos. This permanently destroys tenancy history and
                    cannot be undone.
                  </p>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={closeDialog}
                    disabled={isPending}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirm(true)}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isPending ? "Deleting…" : "Force delete (dev)"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-foreground-muted">
                  Are you sure you want to permanently delete{" "}
                  <strong className="text-foreground">{roomLabel}</strong> and its photos? This cannot be
                  undone. Rooms with an active tenant or tenancy history can&apos;t be deleted.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={closeDialog}
                    disabled={isPending}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirm(false)}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isPending ? "Deleting…" : "Delete room"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

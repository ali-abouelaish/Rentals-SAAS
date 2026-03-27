"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProperty } from "../actions/properties";

interface Props {
  propertyId: string;
  propertyName: string;
  /** Called after successful deletion (used in list view to remove row from state) */
  onDeleted?: () => void;
  /** When true, router.push("/properties") after deletion (used on detail pages) */
  redirectAfter?: boolean;
}

export function DeletePropertyButton({ propertyId, propertyName, onDeleted, redirectAfter }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        await deleteProperty(propertyId);
        toast.success("Property deleted");
        setOpen(false);
        onDeleted?.();
        if (redirectAfter) router.push("/properties");
      } catch (err) {
        toast.error("Failed to delete property", {
          description: err instanceof Error ? err.message : "Something went wrong.",
        });
        setOpen(false);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center h-8 w-8 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
        title="Delete property"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-bento bg-surface-card shadow-bento p-6 space-y-4 mx-4">
            <h3 className="text-base font-semibold text-foreground">Delete property</h3>
            <p className="text-sm text-foreground-muted">
              Are you sure you want to permanently delete{" "}
              <strong className="text-foreground">{propertyName}</strong>? All rooms and photos will
              also be deleted. This cannot be undone.
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
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isPending ? "Deleting…" : "Delete property"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

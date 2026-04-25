"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { KeyAssignment, KeyAssignmentReturnedCondition } from "../domain/types";

const CONDITIONS: KeyAssignmentReturnedCondition[] = ["good", "damaged", "lost"];
const CONDITION_LABEL: Record<KeyAssignmentReturnedCondition, string> = {
  good: "Good",
  damaged: "Damaged",
  lost: "Lost",
};

function holderName(a: KeyAssignment): string {
  if (a.heldBy.kind === "user") return a.heldBy.name ?? "Internal agent";
  return a.heldBy.name;
}

function durationLabel(checkedOutAt: string): string {
  const ms = Date.now() - new Date(checkedOutAt).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  if (hours < 24) return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function KeyCheckinDialog({
  keyId,
  keyLabel,
  assignment,
  open,
  onClose,
}: {
  keyId: string;
  keyLabel: string;
  assignment: KeyAssignment | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [condition, setCondition] = useState<KeyAssignmentReturnedCondition>("good");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  const handleSubmit = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/keys/${keyId}/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            returnedCondition: condition,
            notes: notes.trim() ? notes.trim() : null,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to check in key");
        }
        toast.success("Key checked in");
        onClose();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to check in key");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface-card shadow-2xl">
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Check in key</h2>
            <p className="text-xs text-foreground-muted mt-0.5">{keyLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-foreground-secondary hover:text-foreground hover:bg-surface-inset transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {assignment && (
            <div className="rounded-xl border border-border bg-surface-inset px-3 py-2 text-xs text-foreground-secondary">
              <span className="text-foreground font-medium">{holderName(assignment)}</span> had it
              for {durationLabel(assignment.checkedOutAt)}
              {assignment.expectedReturnAt &&
                ` · expected back ${new Date(assignment.expectedReturnAt).toLocaleString()}`}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Returned condition
            </label>
            <div className="flex gap-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={`flex-1 h-8 rounded-lg border text-xs font-medium ${
                    condition === c
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border bg-surface-card text-foreground-secondary"
                  }`}
                >
                  {CONDITION_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-surface-card px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleSubmit} loading={isPending}>
            Check in
          </Button>
        </div>
      </div>
    </div>
  );
}

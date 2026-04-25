"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { KEY_PURPOSES, KEY_PURPOSE_LABELS, type KeyAssignmentPurpose } from "../domain/types";

type AgentOption = { id: string; name: string };

type HolderKind = "user" | "contact";

const QUICK_RETURN_OPTIONS: Array<{ label: string; minutes: number }> = [
  { label: "In 1 hour", minutes: 60 },
  { label: "In 2 hours", minutes: 120 },
  { label: "End of today", minutes: 0 /* special */ },
  { label: "Tomorrow 9am", minutes: -1 /* special */ },
];

function quickReturnIso(opt: { label: string; minutes: number }): string {
  const now = new Date();
  if (opt.label === "End of today") {
    const eod = new Date(now);
    eod.setHours(18, 0, 0, 0);
    return eod.toISOString();
  }
  if (opt.label === "Tomorrow 9am") {
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    tom.setHours(9, 0, 0, 0);
    return tom.toISOString();
  }
  return new Date(now.getTime() + opt.minutes * 60_000).toISOString();
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  // datetime-local expects YYYY-MM-DDTHH:mm with no Z, in local time
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function KeyCheckoutDialog({
  keyId,
  keyLabel,
  agents,
  open,
  onClose,
}: {
  keyId: string;
  keyLabel: string;
  agents: AgentOption[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [holderKind, setHolderKind] = useState<HolderKind>("user");
  const [userId, setUserId] = useState<string>(agents[0]?.id ?? "");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [purpose, setPurpose] = useState<KeyAssignmentPurpose>("viewing");
  const [expectedReturnLocal, setExpectedReturnLocal] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  const setQuickReturn = (opt: (typeof QUICK_RETURN_OPTIONS)[number]) => {
    setExpectedReturnLocal(toLocalInputValue(quickReturnIso(opt)));
  };

  const handleSubmit = () => {
    if (holderKind === "user" && !userId) {
      toast.error("Pick an internal agent");
      return;
    }
    if (holderKind === "contact" && contactName.trim().length === 0) {
      toast.error("Enter the holder's name");
      return;
    }

    const payload = {
      heldByUserId: holderKind === "user" ? userId : null,
      heldByContactName: holderKind === "contact" ? contactName.trim() : null,
      heldByContactPhone:
        holderKind === "contact" && contactPhone.trim() ? contactPhone.trim() : null,
      purpose,
      expectedReturnAt: expectedReturnLocal
        ? new Date(expectedReturnLocal).toISOString()
        : null,
      notes: notes.trim() ? notes.trim() : null,
    };

    startTransition(async () => {
      try {
        const res = await fetch(`/api/keys/${keyId}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to check out key");
        }
        toast.success("Key checked out");
        onClose();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to check out key");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface-card shadow-2xl">
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Check out key</h2>
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
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Holder
            </label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setHolderKind("user")}
                className={`flex-1 h-8 rounded-lg border text-xs font-medium ${
                  holderKind === "user"
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-surface-card text-foreground-secondary"
                }`}
              >
                Internal agent
              </button>
              <button
                type="button"
                onClick={() => setHolderKind("contact")}
                className={`flex-1 h-8 rounded-lg border text-xs font-medium ${
                  holderKind === "contact"
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-surface-card text-foreground-secondary"
                }`}
              >
                Other person
              </button>
            </div>
            {holderKind === "user" ? (
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-surface-card px-2 text-sm"
              >
                {agents.length === 0 && <option value="">No agents available</option>}
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Full name"
                  className="h-9 w-full rounded-lg border border-border bg-surface-card px-2 text-sm"
                />
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="h-9 w-full rounded-lg border border-border bg-surface-card px-2 text-sm"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Purpose
            </label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as KeyAssignmentPurpose)}
              className="h-9 w-full rounded-lg border border-border bg-surface-card px-2 text-sm"
            >
              {KEY_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {KEY_PURPOSE_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Expected return
            </label>
            <input
              type="datetime-local"
              value={expectedReturnLocal}
              onChange={(e) => setExpectedReturnLocal(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-surface-card px-2 text-sm"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_RETURN_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setQuickReturn(opt)}
                  className="text-[11px] px-2 py-1 rounded-md border border-border bg-surface-inset text-foreground-secondary hover:text-foreground"
                >
                  {opt.label}
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
            Check out
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type UnitOption = {
  id: string;
  label: string;
};

type DraftRow = {
  id: string;
  unitId: string | "";
  setName: string;
  copyLabel: string;
  notes: string;
};

function newDraft(setName = "", copyIdx = 1): DraftRow {
  return {
    id: crypto.randomUUID(),
    unitId: "",
    setName,
    copyLabel: `#${copyIdx}`,
    notes: "",
  };
}

export function AddKeysDialog({
  propertyId,
  units,
  open,
  onClose,
}: {
  propertyId: string;
  units: UnitOption[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<DraftRow[]>([newDraft()]);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  const updateRow = (id: string, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    const last = rows[rows.length - 1];
    const sameSetCount = rows.filter((r) => r.setName === last?.setName).length;
    setRows((prev) => [
      ...prev,
      {
        ...newDraft(last?.setName ?? "", sameSetCount + 1),
        unitId: last?.unitId ?? "",
      },
    ]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const handleSubmit = () => {
    const cleaned = rows.map((r) => ({
      unitId: r.unitId === "" ? null : r.unitId,
      setName: r.setName.trim(),
      copyLabel: r.copyLabel.trim(),
      notes: r.notes.trim() ? r.notes.trim() : null,
    }));

    const invalid = cleaned.findIndex(
      (r) => r.setName.length === 0 || r.copyLabel.length === 0
    );
    if (invalid !== -1) {
      toast.error(`Row ${invalid + 1} is missing a set name or label`);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/properties/${propertyId}/keys`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys: cleaned }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to register keys");
        }
        toast.success(`${cleaned.length} key${cleaned.length === 1 ? "" : "s"} registered`);
        onClose();
        setRows([newDraft()]);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to register keys");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-border bg-surface-card shadow-2xl">
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Register keys</h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              Each row is one physical key. Group keys with a shared set name (e.g. &quot;Front
              door&quot;).
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-foreground-secondary hover:text-foreground hover:bg-surface-inset transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4 space-y-3">
          {rows.map((row, idx) => (
            <div
              key={row.id}
              className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl border border-border bg-surface-inset"
            >
              <div className="col-span-3">
                <label className="block text-[11px] font-medium text-foreground-secondary mb-1">
                  Unit (optional)
                </label>
                <select
                  value={row.unitId}
                  onChange={(e) => updateRow(row.id, { unitId: e.target.value })}
                  className="h-9 w-full rounded-lg border border-border bg-surface-card px-2 text-xs"
                >
                  <option value="">Property-level</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-4">
                <label className="block text-[11px] font-medium text-foreground-secondary mb-1">
                  Set name
                </label>
                <input
                  value={row.setName}
                  onChange={(e) => updateRow(row.id, { setName: e.target.value })}
                  placeholder="Front door"
                  className="h-9 w-full rounded-lg border border-border bg-surface-card px-2 text-xs"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-foreground-secondary mb-1">
                  Copy
                </label>
                <input
                  value={row.copyLabel}
                  onChange={(e) => updateRow(row.id, { copyLabel: e.target.value })}
                  placeholder="#1"
                  className="h-9 w-full rounded-lg border border-border bg-surface-card px-2 text-xs"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-foreground-secondary mb-1">
                  Notes
                </label>
                <input
                  value={row.notes}
                  onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                  placeholder="Green tag"
                  className="h-9 w-full rounded-lg border border-border bg-surface-card px-2 text-xs"
                />
              </div>

              <div className="col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label={`Remove row ${idx + 1}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-hover"
          >
            <Plus size={14} /> Add another row
          </button>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleSubmit} loading={isPending}>
            Register {rows.length} key{rows.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </div>
  );
}

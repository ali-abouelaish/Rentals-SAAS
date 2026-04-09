"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { toast } from "sonner";
import { updateBonus, deleteBonusAction } from "@/features/bonuses/actions/bonuses";
import { ConfirmDeleteForm } from "@/components/shared/ConfirmDeleteForm";
import Link from "next/link";
import { Gift, Pencil, X, Eye } from "lucide-react";

type BonusRow = {
  id: string;
  code: string | null;
  bonus_date: string;
  client_name: string;
  property_address: string;
  amount_owed: number;
  payout_mode: string;
  status: string;
  landlord_id: string;
  agent_id: string;
  notes?: string | null;
  landlords?: { name: string | null }[] | null;
  agent?: { display_name: string | null }[] | null;
};

function formatBonusCode(code: string | null, fallbackId: string) {
  if (!code) return fallbackId.slice(0, 8);
  return code.startsWith("LC") ? code : `LC${code}`;
}

export function BonusesTableWithInvoice({ bonuses, isAdmin }: { bonuses: BonusRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteState, deleteAction] = useFormState(deleteBonusAction, { ok: false });

  const selectedLandlord = useMemo(() => {
    const first = bonuses.find((bonus) => selected.includes(bonus.id));
    return first?.landlord_id ?? null;
  }, [bonuses, selected]);

  const toggle = (bonus: BonusRow) => {
    if (!["approved", "pending"].includes(bonus.status)) {
      toast.error("Only approved or pending bonuses can be invoiced.");
      return;
    }
    if (!selectedLandlord || selectedLandlord === bonus.landlord_id) {
      setSelected((prev) =>
        prev.includes(bonus.id) ? prev.filter((item) => item !== bonus.id) : [...prev, bonus.id]
      );
      return;
    }
    toast.error("Please select bonuses from the same landlord.");
  };

  const handleCreate = () => {
    if (selected.length === 0) return;
    const ids = JSON.stringify(selected);
    router.push(`/invoices/from-bonuses?bonus_ids=${encodeURIComponent(ids)}`);
  };

  return (
    <div className="space-y-3">
      <DeleteToast state={deleteState} />

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-foreground-muted">
          {selected.length > 0 ? (
            <>
              <span className="font-semibold text-brand">{selected.length}</span> selected
              {" · "}
              <span className="font-semibold text-foreground">
                {formatCurrency(
                  bonuses
                    .filter((b) => selected.includes(b.id))
                    .reduce((sum, b) => sum + b.amount_owed, 0)
                )}
              </span>{" "}
              total
            </>
          ) : (
            "Select bonuses to create an invoice"
          )}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={selected.length === 0}
          onClick={handleCreate}
        >
          Create invoice ({selected.length})
        </Button>
      </div>

      {/* Card list */}
      <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
        {bonuses.map((bonus) => {
          const isSelected = selected.includes(bonus.id);
          return (
            <div key={bonus.id}>
              <div
                onClick={() => toggle(bonus)}
                className={`flex items-center gap-3 px-3 py-3 sm:px-4 cursor-pointer transition-colors duration-150 ${isSelected
                    ? "bg-brand-subtle/50"
                    : "hover:bg-surface-inset"
                  }`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(bonus)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={!["approved", "pending"].includes(bonus.status)}
                  className="h-4 w-4 rounded border-border text-brand focus:ring-brand shrink-0"
                />

                {/* Icon — hidden on smallest screens */}
                <div className={`hidden sm:flex h-9 w-9 rounded-lg items-center justify-center shrink-0 ${isSelected ? "bg-brand text-brand-fg" : "bg-surface-inset text-foreground-muted"}`}>
                  <Gift className="h-4 w-4" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">
                      {formatBonusCode(bonus.code, bonus.id)}
                    </span>
                    <StatusBadge status={bonus.status} size="sm" />
                    {/* Amount shown inline on mobile */}
                    <span className="sm:hidden text-xs font-semibold text-foreground tabular-nums ml-auto">
                      {formatCurrency(bonus.amount_owed)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-foreground-muted mt-0.5">
                    <span className="truncate max-w-[120px] sm:max-w-none">{bonus.client_name}</span>
                    <span>·</span>
                    <span className="hidden sm:inline truncate">{bonus.property_address} ·</span>
                    <span className="truncate">{bonus.landlords?.[0]?.name ?? "—"}</span>
                  </div>
                </div>

                {/* Right side — amount (desktop) + actions */}
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {formatCurrency(bonus.amount_owed)}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {formatDate(bonus.bonus_date)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/bonuses/${bonus.id}`}
                      className="inline-flex items-center gap-1 h-8 px-2 rounded-lg text-xs font-medium text-foreground-muted hover:bg-surface-highlight hover:text-foreground transition-colors"
                      title="View and edit bonus"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">View</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingId((prev) => (prev === bonus.id ? null : bonus.id))
                      }
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-foreground-muted hover:bg-surface-highlight hover:text-foreground transition-colors"
                      title="Edit inline"
                    >
                      {editingId === bonus.id ? (
                        <X className="h-3.5 w-3.5" />
                      ) : (
                        <Pencil className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {isAdmin && (
                      <ConfirmDeleteForm
                        action={deleteAction}
                        message="Delete this bonus? This cannot be undone."
                      >
                        <input type="hidden" name="bonus_id" value={bonus.id} />
                        <DeleteButton />
                      </ConfirmDeleteForm>
                    )}
                  </div>
                </div>
              </div>

              {/* Inline edit panel */}
              {editingId === bonus.id && (
                <div className="bg-surface-inset px-3 py-4 sm:px-4 border-t border-border">
                  <form action={updateBonus} className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    <input type="hidden" name="bonus_id" value={bonus.id} />
                    <div>
                      <label className="block text-xs text-foreground-muted mb-1">Date</label>
                      <Input name="bonus_date" type="date" defaultValue={bonus.bonus_date} required />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground-muted mb-1">Client name</label>
                      <Input name="client_name" defaultValue={bonus.client_name} placeholder="Client name" required />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground-muted mb-1">Property address</label>
                      <Input name="property_address" defaultValue={bonus.property_address} placeholder="Property address" required />
                    </div>
                    <input type="hidden" name="agent_id" value={bonus.agent_id} />
                    <input type="hidden" name="landlord_id" value={bonus.landlord_id} />
                    <div>
                      <label className="block text-xs text-foreground-muted mb-1">Amount (£)</label>
                      <Input name="amount_owed" type="number" step="0.01" defaultValue={String(bonus.amount_owed)} required />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground-muted mb-1">Payout mode</label>
                      <select
                        name="payout_mode"
                        defaultValue={bonus.payout_mode}
                        className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm shadow-sm"
                      >
                        <option value="standard">Standard Split</option>
                        <option value="full">Full payout</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-foreground-muted mb-1">Notes</label>
                      <Input name="notes" defaultValue={bonus.notes ?? ""} placeholder="Notes" />
                    </div>
                    <div className="sm:col-span-2 md:col-span-3">
                      <Button type="submit" variant="secondary" size="sm">
                        Save changes
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-7 w-7 rounded-lg flex items-center justify-center text-foreground-muted hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

function DeleteToast({ state }: { state: { ok?: boolean; error?: string } }) {
  useEffect(() => {
    if (state?.ok) {
      toast.success("Bonus deleted.");
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state?.ok, state?.error]);
  return null;
}

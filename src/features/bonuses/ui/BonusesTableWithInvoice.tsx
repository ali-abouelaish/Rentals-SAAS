"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { toast } from "sonner";
import { updateBonus, deleteBonusAction } from "@/features/bonuses/actions/bonuses";
import { ConfirmDeleteForm } from "@/components/shared/ConfirmDeleteForm";

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
  if (!code) return fallbackId;
  return code.startsWith("LC") ? code : `LC${code}`;
}

export function BonusesTableWithInvoice({ bonuses }: { bonuses: BonusRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteState, deleteAction] = useFormState(deleteBonusAction, {});

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
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="secondary"
          disabled={selected.length === 0}
          onClick={handleCreate}
        >
          Create invoice
        </Button>
      </div>
      <DataTable
        columns={[
          "Select",
          "Bonus Code",
          "Date",
          "Agent",
          "Landlord",
          "Property",
          "Client",
          "Commission",
          "Agent Split",
          "Status",
          "Actions"
        ]}
        rows={bonuses.map((bonus) => [
          <input
            key={`${bonus.id}-select`}
            type="checkbox"
            checked={selected.includes(bonus.id)}
            onChange={() => toggle(bonus)}
            disabled={!["approved", "pending"].includes(bonus.status)}
          />,
          <span key={`${bonus.id}-code`} className="text-sm text-navy">
            {formatBonusCode(bonus.code, bonus.id)}
          </span>,
          <span key={`${bonus.id}-date`} className="text-sm text-gray-500">
            {formatDate(bonus.bonus_date)}
          </span>,
          <span key={`${bonus.id}-agent`} className="text-sm text-gray-600">
            {bonus.agent?.[0]?.display_name ?? "Agent"}
          </span>,
          <span key={`${bonus.id}-landlord`} className="text-sm text-gray-600">
            {bonus.landlords?.[0]?.name ?? "Landlord"}
          </span>,
          <span key={`${bonus.id}-property`} className="text-sm text-gray-600">
            {bonus.property_address}
          </span>,
          <span key={`${bonus.id}-client`} className="text-sm text-gray-600">
            {bonus.client_name}
          </span>,
          <span key={`${bonus.id}-commission`} className="text-sm text-gray-600">
            {formatCurrency(bonus.amount_owed)}
          </span>,
          <span key={`${bonus.id}-split`} className="text-sm text-gray-600">
            {bonus.payout_mode === "full" ? "100% full amount" : "Standard split"}
          </span>,
          <StatusBadge key={`${bonus.id}-status`} status={bonus.status} />,
          <div key={`${bonus.id}-action`} className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingId((prev) => (prev === bonus.id ? null : bonus.id))}
            >
              {editingId === bonus.id ? "Close" : "Edit"}
            </Button>
            <ConfirmDeleteForm action={deleteAction} message="Delete this bonus? This cannot be undone.">
              <input type="hidden" name="bonus_id" value={bonus.id} />
              <DeleteButton />
            </ConfirmDeleteForm>
          </div>
        ])}
      />

      {editingId ? (
        <div className="rounded-xl border border-muted p-4">
          {bonuses
            .filter((bonus) => bonus.id === editingId)
            .map((bonus) => (
              <form key={bonus.id} action={updateBonus} className="grid gap-3 md:grid-cols-3">
                <input type="hidden" name="bonus_id" value={bonus.id} />
                <Input name="bonus_date" type="date" defaultValue={bonus.bonus_date} required />
                <Input name="client_name" defaultValue={bonus.client_name} placeholder="Client name" required />
                <Input
                  name="property_address"
                  defaultValue={bonus.property_address}
                  placeholder="Property address"
                  required
                />
                <Input name="landlord_id" defaultValue={bonus.landlord_id} placeholder="Landlord id" required />
                <input type="hidden" name="agent_id" value={bonus.agent_id} />
                <Input
                  name="amount_owed"
                  type="number"
                  step="0.01"
                  defaultValue={String(bonus.amount_owed)}
                  required
                />
                <select
                  name="payout_mode"
                  defaultValue={bonus.payout_mode}
                  className="h-10 w-full rounded-xl border border-muted bg-card px-3 text-sm shadow-sm"
                >
                  <option value="standard">Standard Split</option>
                  <option value="full">Full payout</option>
                </select>
                <Input name="notes" defaultValue={bonus.notes ?? ""} placeholder="Notes" />
                <div className="md:col-span-3">
                  <Button type="submit" variant="secondary">
                    Save changes
                  </Button>
                </div>
              </form>
            ))}
        </div>
      ) : null}

    </div>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "Deleting..." : "Delete"}
    </Button>
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

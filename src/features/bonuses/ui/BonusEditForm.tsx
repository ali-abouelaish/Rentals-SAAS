"use client";

import { useRouter } from "next/navigation";
import { updateBonus } from "@/features/bonuses/actions/bonuses";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type BonusRow = {
  id: string;
  bonus_date: string;
  client_name: string;
  property_address: string;
  amount_owed: number;
  payout_mode: string;
  landlord_id: string;
  agent_id: string;
  notes?: string | null;
};

export function BonusEditForm({
  bonus,
  landlords,
  agents,
  isAdmin,
  currentAgentId
}: {
  bonus: BonusRow;
  landlords: { id: string; name: string }[];
  agents: { id: string; name: string }[];
  isAdmin: boolean;
  currentAgentId: string;
}) {
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await updateBonus(formData);
      toast.success("Bonus updated.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update bonus.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <input type="hidden" name="bonus_id" value={bonus.id} />
      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1.5">Date</label>
        <Input name="bonus_date" type="date" defaultValue={bonus.bonus_date} required />
      </div>
      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1.5">Landlord</label>
        <Select
          name="landlord_id"
          defaultValue={bonus.landlord_id}
          options={landlords.map((l) => ({ label: l.name, value: l.id }))}
          className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1.5">Agent</label>
        {isAdmin ? (
          <Select
            name="agent_id"
            defaultValue={bonus.agent_id}
            options={agents.map((a) => ({ label: a.name, value: a.id }))}
            className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm"
          />
        ) : (
          <>
            <Input
              value={agents.find((a) => a.id === bonus.agent_id)?.name ?? "Agent"}
              readOnly
              className="bg-surface-inset"
            />
            <input type="hidden" name="agent_id" value={bonus.agent_id} />
          </>
        )}
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-foreground-muted mb-1.5">Client name</label>
        <Input name="client_name" defaultValue={bonus.client_name} placeholder="Client name" required />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-foreground-muted mb-1.5">Property address</label>
        <Input name="property_address" defaultValue={bonus.property_address} placeholder="Property address" required />
      </div>
      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1.5">Amount (£)</label>
        <Input
          name="amount_owed"
          type="number"
          step="0.01"
          min="0"
          defaultValue={String(bonus.amount_owed)}
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1.5">Payout mode</label>
        <select
          name="payout_mode"
          defaultValue={bonus.payout_mode}
          className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm border-border text-foreground"
        >
          <option value="standard">Standard Split</option>
          <option value="full">Full payout</option>
        </select>
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="block text-xs font-medium text-foreground-muted mb-1.5">Notes</label>
        <Textarea name="notes" defaultValue={bonus.notes ?? ""} placeholder="Notes" rows={3} className="resize-none" />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <Button type="submit">Save changes</Button>
      </div>
    </form>
  );
}

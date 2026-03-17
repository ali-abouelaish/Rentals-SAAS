"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { bonusSchema, type BonusFormValues } from "../domain/schemas";
import { submitBonus } from "../actions/bonuses";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function BonusForm({
  landlords,
  agents,
  isAdmin,
  currentAgentId,
  onSuccess
}: {
  landlords: { id: string; name: string }[];
  agents: { id: string; name: string }[];
  isAdmin: boolean;
  currentAgentId: string;
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<BonusFormValues>({
    resolver: zodResolver(bonusSchema),
    defaultValues: {
      payout_mode: "standard",
      amount_owed: 0,
      bonus_date: new Date().toISOString().slice(0, 10),
      agent_id: currentAgentId
    }
  });

  useEffect(() => {
    if (agents.length > 0 && !form.getValues("agent_id")) {
      form.setValue("agent_id", agents[0].id);
    }
  }, [agents, form]);

  const onSubmit = (values: BonusFormValues) => {
    startTransition(async () => {
      try {
        await submitBonus(values);
        form.reset({ payout_mode: "standard", amount_owed: 0 });
        toast.success("Bonus submitted successfully.");
        onSuccess?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to submit bonus.");
      }
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 md:grid-cols-3">
      <div>
        <p className="text-xs text-foreground-secondary">Date *</p>
        <Input type="date" placeholder="Date" {...form.register("bonus_date")} required />
      </div>
      <div>
        <p className="text-xs text-foreground-secondary">Agent *</p>
        {isAdmin ? (
          <Select
            value={form.watch("agent_id") ?? ""}
            onChange={(value: string) => form.setValue("agent_id", value)}
            options={agents.map((agent) => ({ label: agent.name, value: agent.id }))}
          />
        ) : (
          <Input
            value={agents.find((agent) => agent.id === currentAgentId)?.name ?? "Agent"}
            disabled
          />
        )}
      </div>
      <div>
        <p className="text-xs text-foreground-secondary">Landlord *</p>
        <Select
          value={form.watch("landlord_id") ?? ""}
          onChange={(value: string) => form.setValue("landlord_id", value)}
          options={landlords.map((landlord) => ({ label: landlord.name, value: landlord.id }))}
          placeholder="Select a landlord"
          required
        />
      </div>
      <div className="md:col-span-2">
        <p className="text-xs text-foreground-secondary">Property *</p>
        <Input placeholder="Enter property address" {...form.register("property_address")} required />
      </div>
      <div>
        <p className="text-xs text-foreground-secondary">Client *</p>
        <Input placeholder="Enter client name" {...form.register("client_name")} required />
      </div>
      <div>
        <p className="text-xs text-foreground-secondary">Commission Amount *</p>
        <Input
          placeholder="£0.00"
          type="number"
          step="0.01"
          min="0"
          {...form.register("amount_owed")}
          required
        />
      </div>
      <div className="md:col-span-2">
        <p className="text-xs text-foreground-secondary">Bonus Split *</p>
        <Select
          value={form.watch("payout_mode")}
          onChange={(value: string) => form.setValue("payout_mode", value as BonusFormValues["payout_mode"])}
          options={[
            { label: "Standard Split (agent commission bonus)", value: "standard" },
            { label: "Full payout (100%)", value: "full" }
          ]}
        />
        <p className="text-xs text-foreground-muted">
          Choose how the bonus is split between agent and agency.
        </p>
      </div>
      <div>
        <p className="text-xs text-foreground-secondary">Status *</p>
        <Input value="Pending" disabled />
      </div>
      <div className="md:col-span-3">
        <p className="text-xs text-foreground-secondary">Notes</p>
        <Textarea placeholder="Notes (optional)" {...form.register("notes")} />
      </div>
      <div className="md:col-span-3">
        <Button type="submit" disabled={isPending}>
          Submit bonus
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { agentUpdateSchema, type AgentUpdateValues } from "../domain/schemas";
import { updateAgentCommission } from "../actions/agents";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AgentCommissionForm({
  userId,
  commission_percent,
  marketing_fee
}: {
  userId: string;
  commission_percent: number;
  marketing_fee: number;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<AgentUpdateValues>({
    resolver: zodResolver(agentUpdateSchema),
    defaultValues: {
      commission_percent,
      marketing_fee
    }
  });

  const onSubmit = (values: AgentUpdateValues) => {
    startTransition(async () => {
      await updateAgentCommission(userId, values);
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-foreground-muted">Commission (%)</label>
        <Input placeholder="e.g. 15" type="number" min="0" {...form.register("commission_percent")} />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-foreground-muted">Marketing fee (£)</label>
        <Input placeholder="e.g. 20" type="number" min="0" {...form.register("marketing_fee")} />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={isPending}>
          Update commission
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { agentUpdateSchema, type AgentUpdateValues } from "../domain/schemas";
import { updateAgentCommission } from "../actions/agents";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const ROLE_OPTIONS = [
  { value: "agent", label: "Agent" },
  { value: "marketing_only", label: "Marketing only" },
  { value: "agent_and_marketing", label: "Agent + Marketing" },
  { value: "admin", label: "Admin" },
] as const;

export function AgentCommissionForm({
  userId,
  commission_percent,
  marketing_fee,
  role
}: {
  userId: string;
  commission_percent: number;
  marketing_fee: number;
  role: string;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<AgentUpdateValues>({
    resolver: zodResolver(agentUpdateSchema),
    defaultValues: {
      commission_percent,
      marketing_fee,
      role: (role as AgentUpdateValues["role"]) ?? "agent"
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
      <div className="space-y-1 md:col-span-2">
        <label className="block text-xs font-medium text-foreground-muted">Role</label>
        <select
          {...form.register("role")}
          className="flex h-10 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand focus:ring-2 focus:ring-border-ring/20 transition-all duration-base"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={isPending}>
          Update
        </Button>
      </div>
    </form>
  );
}

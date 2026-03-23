"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { assignLead } from "../actions/leads";

interface Props {
  leadId: string;
  currentAssignedTo: string | null;
  agents: { id: string; display_name: string | null }[];
}

export function LeadAssignSelect({ leadId, currentAssignedTo, agents }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    startTransition(async () => {
      try {
        await assignLead(leadId, value);
        toast.success("Agent assigned");
      } catch {
        toast.error("Failed to assign agent");
      }
    });
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground-muted">Assigned agent</label>
      <select
        value={currentAssignedTo ?? ""}
        onChange={handleChange}
        disabled={isPending}
        className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
      >
        <option value="">Unassigned</option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.display_name ?? agent.id}
          </option>
        ))}
      </select>
    </div>
  );
}

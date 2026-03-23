"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateLeadStatus } from "../actions/leads";
import type { LeadStatus } from "../domain/types";

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "viewing", label: "Viewing" },
  { value: "offer", label: "Offer" },
  { value: "closed", label: "Closed" },
];

interface Props {
  leadId: string;
  currentStatus: LeadStatus;
}

export function LeadStatusSelect({ leadId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value as LeadStatus;
    startTransition(async () => {
      try {
        await updateLeadStatus(leadId, status);
        toast.success("Status updated");
      } catch {
        toast.error("Failed to update status");
      }
    });
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground-muted">Status</label>
      <select
        value={currentStatus}
        onChange={handleChange}
        disabled={isPending}
        className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

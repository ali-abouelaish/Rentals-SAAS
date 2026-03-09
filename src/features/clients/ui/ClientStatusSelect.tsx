"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateClientStatus } from "../actions/clients";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "on_hold", label: "On Hold" },
  { value: "solved", label: "Solved" },
  { value: "registered", label: "Registered" },
] as const;

export function ClientStatusSelect({
  clientId,
  currentStatus,
}: {
  clientId: string;
  currentStatus: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const status = currentStatus ?? "pending";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    if (newStatus === status) return;
    startTransition(async () => {
      try {
        await updateClientStatus(clientId, newStatus);
        toast.success("Status updated");
        router.refresh();
      } catch {
        toast.error("Failed to update status");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={status}
        onChange={handleChange}
        disabled={isPending}
        className="h-8 rounded-lg border border-border bg-surface-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-border-ring/40 disabled:opacity-50"
        aria-label="Change status"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {isPending && (
        <span className="text-xs text-foreground-muted">Updating…</span>
      )}
    </div>
  );
}

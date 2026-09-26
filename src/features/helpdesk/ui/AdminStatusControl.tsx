"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { updateSupportTicketStatus } from "../actions/admin";
import { STATUS_LABELS_PLATFORM, TICKET_STATUSES, type TicketStatus } from "../domain/types";

/** Change status without writing a reply (e.g. closing a stale ticket). */
export function AdminStatusControl({ ticketId, status }: { ticketId: string; status: TicketStatus }) {
  const router = useRouter();
  const [value, setValue] = useState<TicketStatus>(status);
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const result = await updateSupportTicketStatus(ticketId, value, notify);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(`Status set to ${STATUS_LABELS_PLATFORM[value]}`);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <label htmlFor={`status-${ticketId}`} className="block text-sm font-medium text-foreground">
          Status
        </label>
        <Tooltip content="Change status on its own, e.g. to close a ticket the agency has gone quiet on. To answer AND change status, use the reply box instead.">
          <button type="button" aria-label="About status" className="inline-flex h-6 w-6 items-center justify-center rounded text-foreground-muted hover:text-foreground">
            <Info size={13} />
          </button>
        </Tooltip>
      </div>
      <p className="text-[11px] text-foreground-muted">Resolved/Closed stamp the resolution time.</p>
      <select
        id={`status-${ticketId}`}
        value={value}
        onChange={(e) => setValue(e.target.value as TicketStatus)}
        className="flex h-11 w-full rounded-lg border border-border bg-surface-card px-3 text-base text-foreground md:h-9 sm:text-sm focus:outline-none focus:border-brand"
      >
        {TICKET_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS_PLATFORM[s]}
          </option>
        ))}
      </select>
      <label className="flex min-h-11 items-center gap-2 text-xs text-foreground-secondary md:min-h-0">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4" />
        Email the agency user about this change
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={save}
        loading={saving}
        disabled={value === status}
        className="w-full"
      >
        Update status
      </Button>
    </div>
  );
}

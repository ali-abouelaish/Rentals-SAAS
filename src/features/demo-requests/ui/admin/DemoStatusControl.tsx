"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { updateDemoRequestStatus } from "../../actions/admin";
import { DEMO_REQUEST_STATUSES, STATUS_HINTS, STATUS_LABELS, type DemoRequestStatus } from "../../domain/types";

/** Where a demo request stands. Nothing is emailed when it changes: it's for the team's own tracking. */
export function DemoStatusControl({ requestId, status }: { requestId: string; status: DemoRequestStatus }) {
  const router = useRouter();
  const [value, setValue] = useState<DemoRequestStatus>(status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const result = await updateDemoRequestStatus(requestId, value);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(`Status set to ${STATUS_LABELS[value]}`);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <label htmlFor={`demo-status-${requestId}`} className="block text-sm font-medium text-foreground">
          Status
        </label>
        <Tooltip content="For the team's own tracking: the requester isn't told when this changes. Open requests (New, Contacted, Demo booked) are what the list shows by default.">
          <button type="button" aria-label="About status" className="inline-flex h-6 w-6 items-center justify-center rounded text-foreground-muted hover:text-foreground">
            <Info size={13} />
          </button>
        </Tooltip>
      </div>
      <p className="text-[11px] text-foreground-muted">{STATUS_HINTS[value]}</p>
      <select
        id={`demo-status-${requestId}`}
        value={value}
        onChange={(e) => setValue(e.target.value as DemoRequestStatus)}
        className="flex h-11 w-full rounded-lg border border-border bg-surface-card px-3 text-base text-foreground md:h-9 sm:text-sm focus:outline-none focus:border-brand"
      >
        {DEMO_REQUEST_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-error">{error}</p>}
      <Button type="button" variant="secondary" size="sm" onClick={save} loading={saving} disabled={value === status} className="w-full">
        Update status
      </Button>
    </div>
  );
}

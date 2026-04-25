"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Key as KeyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { KEY_PURPOSE_LABELS, type KeysOutItem } from "../domain/types";

type Filter = "all" | "overdue";

function holderName(item: KeysOutItem): string {
  if (item.heldBy.kind === "user") return item.heldBy.name ?? "Internal agent";
  return item.heldBy.name;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function KeysDashboardPage({ items: initial }: { items: KeysOutItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const overdueCount = useMemo(
    () => initial.filter((i) => i.isOverdue).length,
    [initial]
  );

  const visible = useMemo(() => {
    if (filter === "overdue") return initial.filter((i) => i.isOverdue);
    return initial;
  }, [initial, filter]);

  const onCheckin = (item: KeysOutItem) => {
    if (!confirm(`Check in ${item.key.setName} ${item.key.copyLabel}?`)) return;
    setPendingId(item.key.id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/keys/${item.key.id}/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ returnedCondition: "good" }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to check in key");
        }
        toast.success("Key checked in");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to check in key");
      } finally {
        setPendingId(null);
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Keys</h1>
          <p className="text-sm text-foreground-muted mt-1">
            Every physical key currently out of the office.
          </p>
        </div>
        <div className="text-xs text-foreground-secondary">
          {initial.length} out
          {overdueCount > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-red-600 font-medium">
              <AlertTriangle size={12} /> {overdueCount} overdue
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(["all", "overdue"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "h-8 rounded-lg border px-3 text-xs font-medium",
              filter === f
                ? "border-brand bg-brand/10 text-brand"
                : "border-border bg-surface-card text-foreground-secondary"
            )}
          >
            {f === "all" ? "All out" : "Overdue"}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-bento border border-dashed border-border bg-surface-card p-10 text-center">
          <KeyIcon className="h-7 w-7 mx-auto text-foreground-muted opacity-50 mb-2" />
          <p className="text-sm font-medium text-foreground">
            {filter === "overdue" ? "Nothing overdue" : "All keys are in the office"}
          </p>
        </div>
      ) : (
        <div className="rounded-bento bg-surface-card shadow-bento overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-inset text-[11px] uppercase tracking-wide text-foreground-muted">
              <tr>
                <th className="text-left font-semibold px-4 py-2.5">Property</th>
                <th className="text-left font-semibold px-4 py-2.5">Set / Copy</th>
                <th className="text-left font-semibold px-4 py-2.5">Holder</th>
                <th className="text-left font-semibold px-4 py-2.5">Purpose</th>
                <th className="text-left font-semibold px-4 py-2.5">Out</th>
                <th className="text-left font-semibold px-4 py-2.5">Expected</th>
                <th className="text-right font-semibold px-4 py-2.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((item) => (
                <tr
                  key={item.key.id}
                  className={cn(
                    "hover:bg-surface-inset/40",
                    pendingId === item.key.id && "opacity-60 pointer-events-none"
                  )}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/properties/${item.property.id}`}
                      className="text-sm text-foreground hover:text-brand"
                    >
                      {item.property.address}
                    </Link>
                    {item.unitLabel && (
                      <p className="text-[11px] text-foreground-muted">{item.unitLabel}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {item.key.setName}
                    <span className="text-foreground-muted"> · {item.key.copyLabel}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-foreground">{holderName(item)}</div>
                    {item.heldBy.kind === "contact" && item.heldBy.phone && (
                      <p className="text-[11px] text-foreground-muted">{item.heldBy.phone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground-secondary">
                    {KEY_PURPOSE_LABELS[item.purpose]}
                  </td>
                  <td className="px-4 py-3 text-foreground-secondary">
                    {formatDate(item.checkedOutAt)}
                  </td>
                  <td className="px-4 py-3">
                    {item.expectedReturnAt ? (
                      <span
                        className={cn(
                          item.isOverdue ? "text-red-600 font-medium" : "text-foreground-secondary"
                        )}
                      >
                        {formatDate(item.expectedReturnAt)}
                      </span>
                    ) : (
                      <span className="text-foreground-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="secondary" onClick={() => onCheckin(item)}>
                      Check in
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

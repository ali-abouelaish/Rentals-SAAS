"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Key as KeyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
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

  const columns: DataListColumn<KeysOutItem>[] = [
    {
      key: "property",
      header: "Property",
      priority: "primary",
      cell: (item) => (
        <>
          <Link
            href={`/properties/${item.property.id}`}
            className="text-sm text-foreground hover:text-brand"
          >
            {item.property.address}
          </Link>
          {item.unitLabel && (
            <p className="text-[11px] text-foreground-muted">{item.unitLabel}</p>
          )}
        </>
      ),
    },
    {
      key: "set",
      header: "Set / Copy",
      cell: (item) => (
        <>
          {item.key.setName}
          <span className="text-foreground-muted"> · {item.key.copyLabel}</span>
        </>
      ),
    },
    {
      key: "holder",
      header: "Holder",
      cell: (item) => (
        <>
          <span className="text-foreground">{holderName(item)}</span>
          {item.heldBy.kind === "contact" && item.heldBy.phone && (
            <p className="text-[11px] text-foreground-muted">{item.heldBy.phone}</p>
          )}
        </>
      ),
    },
    { key: "purpose", header: "Purpose", cell: (item) => KEY_PURPOSE_LABELS[item.purpose] },
    { key: "out", header: "Out", cell: (item) => formatDate(item.checkedOutAt) },
    {
      key: "expected",
      header: "Expected",
      cell: (item) =>
        item.expectedReturnAt ? (
          <span className={cn(item.isOverdue ? "text-red-600 font-medium" : undefined)}>
            {formatDate(item.expectedReturnAt)}
          </span>
        ) : (
          <span className="text-foreground-muted">—</span>
        ),
    },
    {
      key: "action",
      header: "Action",
      priority: "action",
      cell: (item) => (
        <Button
          size="sm"
          variant="secondary"
          disabled={pendingId === item.key.id}
          onClick={() => onCheckin(item)}
        >
          Check in
        </Button>
      ),
    },
  ];

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
              "h-11 sm:h-8 rounded-lg border px-3 text-xs font-medium",
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
        /*
         * `DataList`, not a raw table.
         *
         * The wrapper here was `overflow-hidden` around seven columns, so on a
         * phone everything from "Purpose" rightwards — the Check in button
         * included — was clipped away with no way to scroll to it. Clipped
         * content is invisible to the overflow audit too, which is why this
         * survived a green sweep.
         */
        <DataList
          rows={visible}
          getRowKey={(item) => item.key.id}
          caption="Keys currently signed out"
          columns={columns}
        />
      )}
    </div>
  );
}

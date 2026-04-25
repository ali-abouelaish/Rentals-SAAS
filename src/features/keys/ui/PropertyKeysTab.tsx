"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Plus,
  Key as KeyIcon,
  History,
  AlertTriangle,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { KeyStatusPill } from "./KeyStatusPill";
import { AddKeysDialog } from "./AddKeysDialog";
import { KeyCheckoutDialog } from "./KeyCheckoutDialog";
import { KeyCheckinDialog } from "./KeyCheckinDialog";
import { KeyHistoryDrawer, prefetchKeyHistory } from "./KeyHistoryDrawer";
import type {
  KeyAssignment,
  KeyWithCurrent,
  PropertyKeysPayload,
} from "../domain/types";

type AgentOption = { id: string; name: string };
type UnitOption = { id: string; label: string };

function holderLabel(a: KeyAssignment): string {
  if (a.heldBy.kind === "user") return a.heldBy.name ?? "Internal agent";
  return a.heldBy.name;
}

function overdueLabel(a: KeyAssignment): string {
  if (!a.expectedReturnAt) return "";
  const ms = Date.now() - new Date(a.expectedReturnAt).getTime();
  if (ms <= 0) return "";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m overdue`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h overdue`;
  return `${Math.floor(hours / 24)}d overdue`;
}

function summary(group: { keys: KeyWithCurrent[] }): string {
  const total = group.keys.length;
  const inOffice = group.keys.filter((k) => k.status === "in_office").length;
  const out = group.keys.filter((k) => k.status === "loaned").length;
  const withTenant = group.keys.filter((k) => k.status === "with_tenant").length;
  const lost = group.keys.filter((k) => k.status === "lost" || k.status === "destroyed").length;

  const parts: string[] = [];
  parts.push(`${total} key${total === 1 ? "" : "s"}`);
  if (inOffice > 0) parts.push(`${inOffice} in office`);
  if (out > 0) parts.push(`${out} loaned`);
  if (withTenant > 0) parts.push(`${withTenant} with tenant`);
  if (lost > 0) parts.push(`${lost} lost/destroyed`);
  return parts.join(" · ");
}

function KeyRowMenu({
  onHistory,
  onMarkLost,
  onMarkDestroyed,
  onDelete,
  canMarkLost,
  canMarkDestroyed,
  canDelete,
}: {
  onHistory: () => void;
  onMarkLost: () => void;
  onMarkDestroyed: () => void;
  onDelete: () => void;
  canMarkLost: boolean;
  canMarkDestroyed: boolean;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("relative", open && "z-40")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-foreground-secondary hover:bg-surface-inset"
        aria-label="More"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 w-44 rounded-lg border border-border bg-surface-card shadow-lg overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onHistory();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-surface-inset text-left"
            >
              <History size={13} /> View history
            </button>
            {canMarkLost && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onMarkLost();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-surface-inset text-left"
              >
                <AlertTriangle size={13} /> Mark lost
              </button>
            )}
            {canMarkDestroyed && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onMarkDestroyed();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-surface-inset text-left"
              >
                <Trash2 size={13} /> Mark destroyed
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 text-left"
              >
                <Trash2 size={13} /> Delete key
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function PropertyKeysTab({
  payload,
  units,
  agents,
}: {
  payload: PropertyKeysPayload;
  units: UnitOption[];
  agents: AgentOption[];
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [checkoutKey, setCheckoutKey] = useState<KeyWithCurrent | null>(null);
  const [checkinKey, setCheckinKey] = useState<KeyWithCurrent | null>(null);
  const [historyKey, setHistoryKey] = useState<KeyWithCurrent | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const totals = payload.totals;
  const allKeys = useMemo(() => payload.groups.flatMap((g) => g.keys), [payload.groups]);
  const overdue = allKeys.filter((k) => k.currentAssignment?.isOverdue).length;

  const post = (path: string, successMessage: string) => {
    return new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        try {
          const res = await fetch(path, { method: "POST" });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? "Action failed");
          }
          toast.success(successMessage);
          router.refresh();
          resolve();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Action failed");
          reject(err);
        }
      });
    });
  };

  const onMarkLost = async (key: KeyWithCurrent) => {
    if (!confirm(`Mark ${key.setName} ${key.copyLabel} as lost?`)) return;
    setPendingId(key.id);
    try {
      await post(`/api/keys/${key.id}/mark-lost`, "Key marked lost");
    } finally {
      setPendingId(null);
    }
  };

  const onMarkDestroyed = async (key: KeyWithCurrent) => {
    if (!confirm(`Mark ${key.setName} ${key.copyLabel} as destroyed?`)) return;
    setPendingId(key.id);
    try {
      await post(`/api/keys/${key.id}/mark-destroyed`, "Key marked destroyed");
    } finally {
      setPendingId(null);
    }
  };

  const onDelete = async (key: KeyWithCurrent) => {
    if (!confirm(`Delete ${key.setName} ${key.copyLabel}? This removes the key but keeps its history.`))
      return;
    setPendingId(key.id);
    try {
      const res = await fetch(`/api/keys/${key.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete key");
      }
      toast.success("Key deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete key");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-bento bg-surface-card shadow-bento p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Keys</h2>
          <p className="text-xs text-foreground-muted mt-0.5">
            {totals.registered} registered · {totals.out} currently out
            {overdue > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-600 font-medium">
                <AlertTriangle size={12} /> {overdue} overdue
              </span>
            )}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Add keys
        </Button>
      </div>

      {payload.groups.length === 0 && (
        <div className="rounded-bento border border-dashed border-border bg-surface-card p-10 text-center">
          <KeyIcon className="h-7 w-7 mx-auto text-foreground-muted opacity-50 mb-2" />
          <p className="text-sm font-medium text-foreground">No keys registered yet</p>
          <p className="text-xs text-foreground-muted mt-1 mb-4">
            Track every front-door, room, and bin-store key for this property.
          </p>
          <Button variant="secondary" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add keys
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {payload.groups.map((group) => (
          <div
            key={`${group.unitId ?? "prop"}-${group.setName}`}
            className="rounded-bento bg-surface-card shadow-bento"
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {group.unitLabel ? `${group.unitLabel} · ${group.setName}` : group.setName}
                </h3>
                <p className="text-[11px] text-foreground-muted mt-0.5">{summary(group)}</p>
              </div>
            </div>

            <ul className="divide-y divide-border">
              {group.keys.map((key) => {
                const a = key.currentAssignment;
                const overdueText = a ? overdueLabel(a) : "";
                const showCheckout = key.status === "in_office";
                const showCheckin = key.status === "loaned" || key.status === "with_tenant";

                return (
                  <li
                    key={key.id}
                    onClick={() => setHistoryKey(key)}
                    onMouseEnter={() => prefetchKeyHistory(key.id)}
                    onFocus={() => prefetchKeyHistory(key.id)}
                    className={cn(
                      "px-5 py-3 flex items-center justify-between gap-3 relative cursor-pointer hover:bg-surface-inset/40 transition-colors",
                      pendingId === key.id && "opacity-60 pointer-events-none"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">
                          {key.copyLabel}
                        </span>
                        <KeyStatusPill status={key.status} />
                        {overdueText && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                            <AlertTriangle size={10} /> {overdueText}
                          </span>
                        )}
                      </div>
                      {a && (
                        <p className="text-[11px] text-foreground-muted mt-1">
                          With <span className="text-foreground">{holderLabel(a)}</span>
                          {a.expectedReturnAt &&
                            ` · expected back ${new Date(a.expectedReturnAt).toLocaleString()}`}
                        </p>
                      )}
                      {!a && key.notes && (
                        <p className="text-[11px] text-foreground-muted mt-1">{key.notes}</p>
                      )}
                    </div>

                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {showCheckout && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setCheckoutKey(key)}
                        >
                          Check out
                        </Button>
                      )}
                      {showCheckin && (
                        <Button size="sm" variant="secondary" onClick={() => setCheckinKey(key)}>
                          Check in
                        </Button>
                      )}
                      <KeyRowMenu
                        onHistory={() => setHistoryKey(key)}
                        onMarkLost={() => onMarkLost(key)}
                        onMarkDestroyed={() => onMarkDestroyed(key)}
                        onDelete={() => onDelete(key)}
                        canMarkLost={key.status !== "lost" && key.status !== "destroyed"}
                        canMarkDestroyed={key.status !== "destroyed"}
                        canDelete={key.status !== "loaned" && key.status !== "with_tenant"}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <AddKeysDialog
        propertyId={payload.property.id}
        units={units}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
      {checkoutKey && (
        <KeyCheckoutDialog
          keyId={checkoutKey.id}
          keyLabel={`${checkoutKey.setName} · ${checkoutKey.copyLabel}`}
          agents={agents}
          open
          onClose={() => setCheckoutKey(null)}
        />
      )}
      {checkinKey && (
        <KeyCheckinDialog
          keyId={checkinKey.id}
          keyLabel={`${checkinKey.setName} · ${checkinKey.copyLabel}`}
          assignment={checkinKey.currentAssignment}
          open
          onClose={() => setCheckinKey(null)}
        />
      )}
      {historyKey && (
        <KeyHistoryDrawer
          keyId={historyKey.id}
          keyLabel={`${historyKey.setName} · ${historyKey.copyLabel}`}
          open
          onClose={() => setHistoryKey(null)}
        />
      )}
    </div>
  );
}

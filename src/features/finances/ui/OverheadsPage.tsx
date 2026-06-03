"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  OVERHEAD_CATEGORY_LABELS,
  type BusinessOverhead,
} from "../domain/overheads";
import { deleteOverhead } from "../actions/overheads";
import { OverheadDrawer } from "./OverheadDrawer";

const COST_MODE_LABEL: Record<BusinessOverhead["cost_mode"], string> = {
  recurring: "Recurring",
  one_off: "One-off",
  amortised: "Amortised",
};

function formatPounds(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString()}`;
}

function modeDetail(o: BusinessOverhead): string {
  if (o.cost_mode === "recurring") {
    return o.recurrence_day ? `Day ${o.recurrence_day} each month` : "Monthly";
  }
  if (o.cost_mode === "amortised") {
    return o.amortise_months ? `Over ${o.amortise_months} months` : "Amortised";
  }
  return new Date(o.date_incurred).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function OverheadsPage({ overheads }: { overheads: BusinessOverhead[] }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessOverhead | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const recurring = overheads.filter((o) => o.cost_mode === "recurring");
  const amortised = overheads.filter((o) => o.cost_mode === "amortised");
  const oneOff = overheads.filter((o) => o.cost_mode === "one_off");

  const monthlyTotal = recurring
    .filter((o) => o.is_active)
    .reduce((s, o) => s + o.amount, 0)
    + amortised
      .filter((o) => o.is_active)
      .reduce((s, o) => s + (o.amortise_months ? Math.round(o.amount / o.amortise_months) : 0), 0);

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }
  function openEdit(o: BusinessOverhead) {
    setEditing(o);
    setDrawerOpen(true);
  }
  async function onDelete(o: BusinessOverhead) {
    if (!confirm(`Delete "${o.label}"? This can't be undone.`)) return;
    setDeletingId(o.id);
    try {
      const res = await deleteOverhead(o.id);
      if (res?.error) toast.error(res.error);
      else toast.success("Overhead removed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
          <Wallet className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Admin Overheads</h1>
          <p className="text-xs text-foreground-secondary truncate">
            Business-level costs (software, payroll, office, etc.) that aren&apos;t tied to a property.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/finances">Back to Finances</Link>
        </Button>
        <Button variant="secondary" size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          Add overhead
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Recurring (active)" value={`${recurring.filter((o) => o.is_active).length}`} />
        <Stat label="Amortised (active)" value={`${amortised.filter((o) => o.is_active).length}`} />
        <Stat label="One-off (total)" value={`${oneOff.length}`} />
        <Stat label="Monthly run-rate" value={formatPounds(monthlyTotal)} tone="muted" />
      </div>

      {overheads.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <Wallet className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">No overheads yet</p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto mb-4">
            Add software subscriptions, payroll, office rent, and other business costs so your
            Finances P&amp;L reflects total profitability — not just per-property numbers.
          </p>
          <Button variant="secondary" size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add the first overhead
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-inset">
                <tr className="text-left text-[11px] uppercase tracking-wider text-foreground-muted">
                  <th className="px-4 py-2 font-semibold">Label</th>
                  <th className="px-4 py-2 font-semibold">Category</th>
                  <th className="px-4 py-2 font-semibold">Mode</th>
                  <th className="px-4 py-2 font-semibold">Schedule</th>
                  <th className="px-4 py-2 font-semibold text-right">Amount</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overheads.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2 text-foreground">
                      <div className="font-medium">{o.label}</div>
                      {o.vendor ? (
                        <div className="text-[11px] text-foreground-secondary">{o.vendor}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-foreground-secondary">
                      {OVERHEAD_CATEGORY_LABELS[o.category]}
                    </td>
                    <td className="px-4 py-2 text-foreground-secondary">
                      {COST_MODE_LABEL[o.cost_mode]}
                    </td>
                    <td className="px-4 py-2 text-foreground-secondary">{modeDetail(o)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground font-medium">
                      {formatPounds(o.amount)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          o.is_active
                            ? "inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200"
                            : "inline-flex items-center rounded-full bg-surface-inset px-2 py-0.5 text-[11px] font-semibold text-foreground-muted border border-border"
                        }
                      >
                        {o.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => openEdit(o)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => onDelete(o)}
                          disabled={deletingId === o.id}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <OverheadDrawer
        open={drawerOpen}
        editing={editing}
        onClose={() => setDrawerOpen(false)}
        onSuccess={() => {
          /* router refresh handled by revalidatePath in the action */
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "muted";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-foreground-muted font-semibold">
        {label}
      </p>
      <p
        className={`text-2xl font-bold tracking-tight mt-1 tabular-nums ${
          tone === "muted" ? "text-foreground-muted" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

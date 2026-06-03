"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Pencil, Trash2, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  TENANT_CHARGE_TYPE_LABELS,
  type TenantRecurringCharge,
} from "../domain/tenant-charges";
import { deleteTenantCharge } from "../actions/tenant-charges";
import { TenantChargeModal } from "./TenantChargeModal";
import type { ContractOption, TenantChargeWithContext } from "../data/tenant-charges";

function formatPounds(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString()}`;
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function TenantChargesPage({
  charges,
  contracts,
}: {
  charges: TenantChargeWithContext[];
  contracts: ContractOption[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TenantRecurringCharge | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeCount = charges.filter((c) => c.is_active).length;
  const monthlyTotal = charges
    .filter((c) => c.is_active)
    .reduce((s, c) => s + c.amount, 0);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(c: TenantRecurringCharge) {
    setEditing(c);
    setOpen(true);
  }
  async function onDelete(c: TenantChargeWithContext) {
    if (!confirm(`Delete "${c.label}" from ${c.context?.tenant_name ?? "this contract"}? This can't be undone.`)) return;
    setDeletingId(c.id);
    try {
      const res = await deleteTenantCharge(c.id);
      if (res?.error) toast.error(res.error);
      else toast.success("Charge removed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
          <ReceiptText className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Tenant Charges</h1>
          <p className="text-xs text-foreground-secondary truncate">
            Recurring charges on top of rent — utilities, service, parking, cleaning.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/finances">Back to Finances</Link>
        </Button>
        <Button variant="secondary" size="sm" onClick={openCreate} disabled={contracts.length === 0 && charges.length === 0}>
          <Plus className="h-3.5 w-3.5" />
          Add charge
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Stat label="Total charges" value={`${charges.length}`} />
        <Stat label="Active" value={`${activeCount}`} />
        <Stat label="Active monthly total" value={formatPounds(monthlyTotal)} tone="muted" />
      </div>

      {charges.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <ReceiptText className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">No tenant charges yet</p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto mb-4">
            Add recurring tenant-side charges (utilities, service, parking, etc.) to surface
            them in the Finances P&amp;L alongside rent.
          </p>
          {contracts.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              Add the first charge
            </Button>
          ) : (
            <p className="text-[11px] text-foreground-muted">
              No active contracts available. Create a contract first.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-inset">
                <tr className="text-left text-[11px] uppercase tracking-wider text-foreground-muted">
                  <th className="px-4 py-2 font-semibold">Tenant / Property</th>
                  <th className="px-4 py-2 font-semibold">Charge</th>
                  <th className="px-4 py-2 font-semibold">Type</th>
                  <th className="px-4 py-2 font-semibold">Schedule</th>
                  <th className="px-4 py-2 font-semibold">Window</th>
                  <th className="px-4 py-2 font-semibold text-right">Amount</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {charges.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-foreground">
                      <div className="font-medium">{c.context?.tenant_name ?? "—"}</div>
                      <div className="text-[11px] text-foreground-secondary">
                        {c.context?.property_name ?? "—"} · {c.context?.unit_label ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-foreground">{c.label}</td>
                    <td className="px-4 py-2 text-foreground-secondary">
                      {TENANT_CHARGE_TYPE_LABELS[c.charge_type]}
                    </td>
                    <td className="px-4 py-2 text-foreground-secondary">Day {c.recurrence_day}</td>
                    <td className="px-4 py-2 text-foreground-secondary">
                      {fmtDate(c.start_date)} → {c.end_date ? fmtDate(c.end_date) : "ongoing"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-foreground font-medium">
                      {formatPounds(c.amount)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          c.is_active
                            ? "inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200"
                            : "inline-flex items-center rounded-full bg-surface-inset px-2 py-0.5 text-[11px] font-semibold text-foreground-muted border border-border"
                        }
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="xs" onClick={() => openEdit(c)} aria-label="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => onDelete(c)}
                          disabled={deletingId === c.id}
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

      <TenantChargeModal
        open={open}
        editing={editing}
        contracts={contracts}
        onClose={() => setOpen(false)}
        onSuccess={() => {
          /* revalidatePath handled in the server action */
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

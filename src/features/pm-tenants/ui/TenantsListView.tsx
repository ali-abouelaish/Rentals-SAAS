"use client";

import { useState } from "react";
import { AlertTriangle, Bell, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { EMPLOYMENT_STATUS_LABELS } from "../domain/types";
import type { PmTenant } from "../domain/types";
import { SendReminderDialog } from "@/features/reminders/ui/SendReminderDialog";
import type { ReminderStatusMap } from "@/features/reminders/data/status";

interface TenantsListViewProps {
  tenants: PmTenant[];
  reminderStatus: ReminderStatusMap;
  onTenantClick: (id: string) => void;
}

function UnitLabel({ tenant }: { tenant: PmTenant }) {
  const unit = tenant.current_unit;
  if (!unit) return <span className="text-foreground-muted italic">No unit assigned</span>;

  const label =
    unit.unit_type === "room"
      ? unit.room_number
        ? `Room ${unit.room_number}`
        : "Room"
      : unit.unit_type === "studio"
      ? "Studio"
      : "Whole Flat";

  return (
    <span>
      {unit.property?.name ?? "Unknown property"} — {label}
    </span>
  );
}

function ReminderButton({
  pmTenantId,
  tenantName,
  kind,
  daysOverdue,
}: {
  pmTenantId: string;
  tenantName: string;
  kind: "no_contract" | "upcoming" | "due_today" | "overdue";
  daysOverdue: number;
}) {
  const [open, setOpen] = useState(false);

  if (kind === "no_contract") {
    return <span className="text-xs text-foreground-muted">No contract</span>;
  }

  const overdue = kind === "overdue";
  const label = overdue
    ? `Send overdue notice${daysOverdue ? ` (${daysOverdue}d)` : ""}`
    : kind === "due_today"
      ? "Send due-today reminder"
      : "Send rent reminder";

  return (
    <>
      <button
        type="button"
        title={label}
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-11 sm:min-h-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
          overdue
            ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
            : "border-border bg-surface-card text-foreground-secondary hover:border-brand hover:bg-brand/5 hover:text-brand"
        )}
      >
        {overdue ? <AlertTriangle className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
        {label}
      </button>
      <SendReminderDialog
        open={open}
        pmTenantId={pmTenantId}
        tenantName={tenantName}
        onOpenChange={setOpen}
      />
    </>
  );
}

export function TenantsListView({ tenants, reminderStatus, onTenantClick }: TenantsListViewProps) {
  if (tenants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <UserCircle className="h-12 w-12 text-foreground-muted mb-3" />
        <h3 className="text-base font-semibold text-foreground">No tenants found</h3>
        <p className="text-sm text-foreground-secondary mt-1">
          Add a tenant manually or approve a booking to auto-create one.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-bento bg-surface-card shadow-bento overflow-hidden">
      {/* Header — the five-column grid is desktop only. At 360px it gave each
          1fr column about 25px, and `truncate` hid the damage rather than
          fixing it: every value became an ellipsis. */}
      <div className="hidden md:grid grid-cols-[1fr_1.5fr_1fr_1fr_180px] gap-4 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted border-b border-border bg-surface-inset">
        <span>Name</span>
        <span>Unit</span>
        <span>Nationality</span>
        <span>Employment</span>
        <span className="text-right">Reminder</span>
      </div>

      {/* Rows */}
      {tenants.map((tenant, i) => {
        const status = reminderStatus[tenant.id] ?? { kind: "no_contract" as const, daysOverdue: 0, dueDate: null };
        return (
          <div
            key={tenant.id}
            role="button"
            tabIndex={0}
            onClick={() => onTenantClick(tenant.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onTenantClick(tenant.id); }}
            className={cn(
              "w-full text-left text-sm border-b border-border-muted last:border-0",
              "flex flex-col gap-2 px-4 py-3.5",
              "md:grid md:grid-cols-[1fr_1.5fr_1fr_1fr_180px] md:gap-4 md:border-0",
              "hover:bg-surface-inset transition-colors cursor-pointer",
              i % 2 === 0 ? "" : "bg-surface-inset/40"
            )}
          >
            {/* Identity — the card's heading on a phone, column one on desktop */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-medium text-foreground [overflow-wrap:anywhere] md:truncate">
                {tenant.full_name ?? "Unnamed tenant"}
              </span>
              <span className="text-[11px] text-foreground-muted [overflow-wrap:anywhere] md:truncate">
                {tenant.email ?? "—"}
              </span>
            </div>

            {/* Unit */}
            <div className="text-foreground-secondary text-xs flex items-center min-w-0 md:truncate">
              <span className="font-medium text-foreground-muted mr-1.5 md:hidden">Unit</span>
              <UnitLabel tenant={tenant} />
            </div>

            {/* Nationality + employment share a row on a phone: two short
                values do not each need a line of their own. */}
            <div className="flex gap-4 md:contents">
              <div className="text-foreground-secondary text-xs flex items-center min-w-0">
                <span className="font-medium text-foreground-muted mr-1.5 md:hidden">Nationality</span>
                {tenant.nationality ?? "—"}
              </div>

              <div className="text-foreground-secondary text-xs flex items-center min-w-0">
                <span className="font-medium text-foreground-muted mr-1.5 md:hidden">Employment</span>
                {tenant.employment_status
                  ? EMPLOYMENT_STATUS_LABELS[tenant.employment_status]
                  : "—"}
              </div>
            </div>

            <div className="flex items-center md:justify-end" onClick={(e) => e.stopPropagation()}>
              <ReminderButton
                pmTenantId={tenant.id}
                tenantName={tenant.full_name ?? "Unnamed tenant"}
                kind={status.kind}
                daysOverdue={status.daysOverdue}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
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
      {/* Header */}
      <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr_180px] gap-4 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted border-b border-border bg-surface-inset">
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
              "w-full grid grid-cols-[1fr_1.5fr_1fr_1fr_180px] gap-4 px-4 py-3.5 text-left text-sm",
              "hover:bg-surface-inset transition-colors cursor-pointer",
              i % 2 === 0 ? "" : "bg-surface-inset/40"
            )}
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-medium text-foreground truncate">{tenant.full_name ?? "Unnamed tenant"}</span>
              <span className="text-[11px] text-foreground-muted truncate">{tenant.email ?? "—"}</span>
            </div>

            <div className="text-foreground-secondary text-xs truncate flex items-center">
              <UnitLabel tenant={tenant} />
            </div>

            <div className="text-foreground-secondary text-xs flex items-center">
              {tenant.nationality ?? "—"}
            </div>

            <div className="text-foreground-secondary text-xs flex items-center">
              {tenant.employment_status
                ? EMPLOYMENT_STATUS_LABELS[tenant.employment_status]
                : "—"}
            </div>

            <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
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

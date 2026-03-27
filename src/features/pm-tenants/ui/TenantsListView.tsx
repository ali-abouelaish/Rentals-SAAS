"use client";

import { format } from "date-fns";
import { UserCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { RightToRentBadge } from "./RightToRentBadge";
import { EMPLOYMENT_STATUS_LABELS } from "../domain/types";
import type { PmTenant } from "../domain/types";

interface TenantsListViewProps {
  tenants: PmTenant[];
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

export function TenantsListView({ tenants, onTenantClick }: TenantsListViewProps) {
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
      <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr] gap-4 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted border-b border-border bg-surface-inset">
        <span>Name</span>
        <span>Unit</span>
        <span>Nationality</span>
        <span>Right to Rent</span>
        <span>Employment</span>
      </div>

      {/* Rows */}
      {tenants.map((tenant, i) => (
        <button
          key={tenant.id}
          type="button"
          onClick={() => onTenantClick(tenant.id)}
          className={cn(
            "w-full grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr] gap-4 px-4 py-3.5 text-left text-sm",
            "hover:bg-surface-inset transition-colors cursor-pointer",
            i % 2 === 0 ? "" : "bg-surface-inset/40"
          )}
        >
          {/* Name + email */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-medium text-foreground truncate">{tenant.full_name}</span>
            <span className="text-[11px] text-foreground-muted truncate">{tenant.email}</span>
          </div>

          {/* Unit */}
          <div className="text-foreground-secondary text-xs truncate flex items-center">
            <UnitLabel tenant={tenant} />
          </div>

          {/* Nationality */}
          <div className="text-foreground-secondary text-xs flex items-center">
            {tenant.nationality ?? "—"}
          </div>

          {/* Right to Rent */}
          <div className="flex items-center">
            <RightToRentBadge tenant={tenant} />
          </div>

          {/* Employment */}
          <div className="text-foreground-secondary text-xs flex items-center">
            {tenant.employment_status
              ? EMPLOYMENT_STATUS_LABELS[tenant.employment_status]
              : "—"}
          </div>
        </button>
      ))}
    </div>
  );
}

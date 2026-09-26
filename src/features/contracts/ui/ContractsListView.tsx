"use client";

import { FileSignature } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ContractStatusBadge } from "./ContractStatusBadge";
import { DepositBadge } from "./DepositBadge";
import type { PropertyContract } from "../domain/types";

interface ContractsListViewProps {
  contracts: PropertyContract[];
  onContractClick: (id: string) => void;
}

function unitLabel(contract: PropertyContract) {
  const unit = contract.unit;
  if (!unit) return "—";
  const label =
    unit.unit_type === "room"
      ? unit.room_number ? `Room ${unit.room_number}` : "Room"
      : unit.unit_type === "studio" ? "Studio" : "Whole Flat";
  return `${unit.property.name} — ${label}`;
}

export function ContractsListView({ contracts, onContractClick }: ContractsListViewProps) {
  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileSignature className="h-12 w-12 text-foreground-muted mb-3" />
        <h3 className="text-base font-semibold text-foreground">No contracts found</h3>
        <p className="text-sm text-foreground-secondary mt-1">
          Approve a booking to auto-create a draft contract, or create one manually.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-bento bg-surface-card shadow-bento overflow-hidden">
      {/* Header */}
      {/* Six columns share ~296px at 360px, about 40px each — the values were
          all ellipsis. Desktop only; the row becomes a card below md. */}
      <div className="hidden md:grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted border-b border-border bg-surface-inset">
        <span>Tenant</span>
        <span>Unit</span>
        <span>Status</span>
        <span>Start date</span>
        <span>Rent PCM</span>
        <span>Deposit</span>
      </div>

      {contracts.map((contract, i) => (
        <button
          key={contract.id}
          type="button"
          onClick={() => onContractClick(contract.id)}
          className={cn(
            "w-full text-left text-sm border-b border-border-muted last:border-0",
            "flex flex-col gap-2 px-4 py-3.5",
            "md:grid md:grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_1fr] md:gap-4 md:border-0",
            "hover:bg-surface-inset transition-colors cursor-pointer",
            i % 2 === 0 ? "" : "bg-surface-inset/40"
          )}
        >
          {/* Tenant */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-medium text-foreground [overflow-wrap:anywhere] md:truncate">
              {contract.pm_tenant?.full_name ?? "—"}
            </span>
            {contract.notice_given_date && (
              <span className="text-[11px] text-amber-600">
                Notice · vacate {contract.vacate_date ? new Date(contract.vacate_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
              </span>
            )}
          </div>

          {/* Unit */}
          <div className="text-xs text-foreground-secondary flex items-center min-w-0 md:truncate">
            <span className="font-medium text-foreground-muted mr-1.5 shrink-0 md:hidden">Unit</span>
            <span className="[overflow-wrap:anywhere] md:truncate">{unitLabel(contract)}</span>
          </div>

          {/* Status, dates and money wrap together on a phone */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 md:contents">
          <div className="flex items-center">
            <ContractStatusBadge status={contract.status} size="sm" />
          </div>

          {/* Start date */}
          <div className="text-xs text-foreground-secondary flex items-center">
            {new Date(contract.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </div>

          {/* Rent */}
          <div className="text-xs text-foreground flex items-center font-medium">
            £{contract.rent_pcm.toLocaleString()}/mo
          </div>

          {/* Deposit status */}
          <div className="flex items-center">
            <DepositBadge contract={contract} />
          </div>
          </div>
        </button>
      ))}
    </div>
  );
}

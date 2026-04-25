"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { TenancyPaymentsList } from "@/features/contracts/ui/TenancyPaymentsList";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import type { RentCollectionRow as Row } from "../data/queries";

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function balanceLabel(paid: number, expected: number): { text: string; tone: string } {
  if (expected <= 0) return { text: "—", tone: "text-foreground-muted" };
  const balance = expected - paid;
  if (balance > 0) {
    return { text: `£${balance.toLocaleString()} short`, tone: "text-red-600 font-medium" };
  }
  if (balance < 0) {
    return {
      text: `£${Math.abs(balance).toLocaleString()} ahead`,
      tone: "text-emerald-600 font-medium",
    };
  }
  return { text: "On track", tone: "text-foreground-muted" };
}

export function RentCollectionRow({ row }: { row: Row }) {
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const initial = row.tenant.name.charAt(0).toUpperCase() || "?";
  const balance = balanceLabel(row.paid, row.expected);
  const owesMoney = row.arrears > 0;

  const unitLabel = row.unit.roomNumber
    ? `Rm ${row.unit.roomNumber}`
    : row.unit.unitType || "Unit";

  return (
    <div
      className={cn(
        "rounded-xl border bg-surface-card",
        owesMoney ? "border-red-200" : "border-border"
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
            owesMoney ? "bg-red-50" : "bg-brand/10"
          )}
        >
          <span
            className={cn(
              "text-sm font-bold",
              owesMoney ? "text-red-600" : "text-brand"
            )}
          >
            {initial}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/tenants/${row.tenant.id}`}
              className="text-sm font-semibold text-foreground hover:underline truncate"
            >
              {row.tenant.name}
            </Link>
            {row.currentMonthPaid && (
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">
                This month paid
              </span>
            )}
            {!row.currentMonthPaid && (
              <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700 uppercase tracking-wider">
                This month unpaid
              </span>
            )}
          </div>

          <p className="text-xs text-foreground-secondary mt-0.5 truncate">
            {row.property.name} · {unitLabel}
            <span className="text-foreground-muted">
              {" · "}Started {dateFmt(row.startDate)}
              {row.collectionDate && ` · Due ${ordinal(row.collectionDate)}`}
            </span>
          </p>

          <div className="flex items-center gap-3 mt-2 text-xs tabular-nums">
            <span className="text-foreground-secondary">
              £{row.rentPcm.toLocaleString()}/mo
            </span>
            <span className="text-foreground-muted">·</span>
            <span className="text-foreground-secondary">
              Paid <span className="font-medium text-foreground">£{row.paid.toLocaleString()}</span>
              <span className="text-foreground-muted"> / £{row.expected.toLocaleString()}</span>
            </span>
            <span className="text-foreground-muted">·</span>
            <span className={balance.tone}>{balance.text}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Record payment
          </Button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-foreground-muted hover:text-foreground"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide" : "History"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3 text-xs">
          <TenancyPaymentsList
            contractId={row.contractId}
            rentPence={row.rentPcm}
            startDate={row.startDate}
            endDate={null}
          />
        </div>
      )}

      <RecordPaymentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        contractId={row.contractId}
        unitId={row.unitId}
        tenantName={row.tenant.name}
        rentPcm={row.rentPcm}
      />
    </div>
  );
}

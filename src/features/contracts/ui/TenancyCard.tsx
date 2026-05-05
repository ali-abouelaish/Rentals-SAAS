"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { END_REASON_LABELS } from "../domain/types";
import { TenancyPaymentsList } from "./TenancyPaymentsList";
import type { TenancyEntry } from "../domain/history";

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function tenancyDays(start: string, end: string | null): number {
  const startMs = Date.parse(start);
  const endMs = end ? Date.parse(end) : Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 86_400_000));
}

type DepositStatus =
  | { kind: "not_held" }
  | { kind: "active" }
  | { kind: "pending"; held: number }
  | { kind: "full"; held: number }
  | { kind: "partial"; held: number; returned: number }
  | { kind: "retained"; held: number };

function depositStatus(entry: TenancyEntry): DepositStatus {
  const held = entry.depositPence;
  if (!held || held <= 0) return { kind: "not_held" };
  if (entry.endDate === null) return { kind: "active" };
  const returned = entry.depositReturned;
  if (returned == null) return { kind: "pending", held };
  if (returned >= held) return { kind: "full", held };
  if (returned <= 0) return { kind: "retained", held };
  return { kind: "partial", held, returned };
}

const DEPOSIT_BADGE_STYLES: Record<DepositStatus["kind"], string> = {
  not_held: "",
  active: "bg-surface-inset border-border text-foreground-muted",
  pending: "bg-amber-50 border-amber-200 text-amber-700",
  full: "bg-emerald-50 border-emerald-200 text-emerald-700",
  partial: "bg-amber-50 border-amber-200 text-amber-700",
  retained: "bg-red-50 border-red-200 text-red-700",
};

function depositBadgeLabel(s: DepositStatus): string | null {
  switch (s.kind) {
    case "not_held": return null;
    case "active":   return null;
    case "pending":  return "Deposit pending release";
    case "full":     return "Deposit released in full";
    case "partial":  return `Deposit £${s.returned.toLocaleString()} of £${s.held.toLocaleString()} released`;
    case "retained": return "Deposit fully retained";
  }
}

function durationLabel(days: number): string {
  if (days < 31) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 365) {
    const months = Math.round(days / 30.44);
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  const years = Math.floor(days / 365);
  const rem = Math.round((days % 365) / 30.44);
  if (rem === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years}y ${rem}mo`;
}

export function TenancyCard({
  entry,
  onCloseout,
  canCloseout,
}: {
  entry: TenancyEntry;
  onCloseout?: () => void;
  canCloseout: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isCurrent = entry.endDate === null;
  const days = tenancyDays(entry.startDate, entry.endDate);
  const initial = entry.tenant.name.charAt(0).toUpperCase() || "?";
  const deposit = depositStatus(entry);
  const depositLabel = depositBadgeLabel(deposit);

  return (
    <div
      className={cn(
        "rounded-xl border bg-surface-card",
        isCurrent ? "border-brand/40 shadow-sm" : "border-border"
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
            isCurrent ? "bg-brand/10" : "bg-surface-inset"
          )}
        >
          <span
            className={cn(
              "text-sm font-bold",
              isCurrent ? "text-brand" : "text-foreground-muted"
            )}
          >
            {initial}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {entry.tenant.id ? (
              <Link
                href={`/tenants/${entry.tenant.id}`}
                className="text-sm font-semibold text-foreground hover:underline truncate"
              >
                {entry.tenant.name}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-foreground truncate">
                {entry.tenant.name}
              </span>
            )}
            {isCurrent && (
              <span className="rounded-full bg-brand/10 border border-brand/20 px-2 py-0.5 text-[10px] font-semibold text-brand uppercase tracking-wider">
                Current
              </span>
            )}
            {entry.endReason && (
              <span className="rounded-full bg-surface-inset border border-border px-2 py-0.5 text-[10px] font-medium text-foreground-muted">
                {END_REASON_LABELS[entry.endReason]}
              </span>
            )}
            {depositLabel && (
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  DEPOSIT_BADGE_STYLES[deposit.kind]
                )}
              >
                {depositLabel}
              </span>
            )}
          </div>

          <p className="text-xs text-foreground-secondary mt-0.5">
            {dateFmt(entry.startDate)}
            {" → "}
            {entry.endDate ? dateFmt(entry.endDate) : "Present"}
            <span className="text-foreground-muted">
              {" · "}
              {durationLabel(days)}
            </span>
          </p>

          <div className="flex items-center gap-3 mt-2 text-xs text-foreground-secondary">
            <span>£{entry.rentPence.toLocaleString()}/mo</span>
            {entry.depositPence != null && (
              <span>· Deposit £{entry.depositPence.toLocaleString()}</span>
            )}
            {entry.scheduledEndDate && !entry.endDate && (
              <span className="text-amber-600">
                · Vacate {dateFmt(entry.scheduledEndDate)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {canCloseout && isCurrent && onCloseout && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCloseout}
            >
              Close out
            </Button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-foreground-muted hover:text-foreground"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide" : "Details"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3 text-xs">
          <TenancyPaymentsList
            contractId={entry.contractId}
            rentPence={entry.rentPence}
            startDate={entry.startDate}
            endDate={entry.endDate}
            proRataAmount={entry.proRataAmount}
          />

          {(entry.arrearsAtEndPence > 0 ||
            entry.wouldRelet != null ||
            entry.endNotes ||
            deposit.kind === "partial" ||
            deposit.kind === "retained" ||
            entry.depositReturnedAt ||
            entry.depositReleaseNotes) && (
            <div className="pt-2 border-t border-border space-y-2">
              {entry.arrearsAtEndPence > 0 && (
                <div>
                  <p className="text-foreground-muted">Arrears at end</p>
                  <p className="font-medium text-red-600">
                    £{entry.arrearsAtEndPence.toLocaleString()}
                  </p>
                </div>
              )}
              {entry.wouldRelet != null && (
                <div>
                  <p className="text-foreground-muted">Would re-let</p>
                  <p className="font-medium text-foreground">
                    {entry.wouldRelet ? "Yes" : "No"}
                  </p>
                </div>
              )}
              {(deposit.kind === "partial" || deposit.kind === "retained") && (
                <div>
                  <p className="text-foreground-muted">Deposit deductions</p>
                  <p className="font-medium text-foreground tabular-nums">
                    £{(deposit.held - (deposit.kind === "partial" ? deposit.returned : 0)).toLocaleString()}
                    <span className="text-foreground-muted font-normal">
                      {" "}of £{deposit.held.toLocaleString()} held
                    </span>
                  </p>
                </div>
              )}
              {entry.depositReturnedAt && (
                <div>
                  <p className="text-foreground-muted">Deposit released on</p>
                  <p className="font-medium text-foreground">
                    {new Date(entry.depositReturnedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}
              {entry.depositReleaseNotes && (
                <div>
                  <p className="text-foreground-muted mb-0.5">Deposit notes</p>
                  <p className="text-foreground whitespace-pre-wrap">
                    {entry.depositReleaseNotes}
                  </p>
                </div>
              )}
              {entry.endNotes && (
                <div>
                  <p className="text-foreground-muted mb-0.5 flex items-center gap-1">
                    <User className="h-3 w-3" /> Notes
                  </p>
                  <p className="text-foreground whitespace-pre-wrap">{entry.endNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

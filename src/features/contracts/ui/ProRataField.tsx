"use client";

import { useEffect, useRef, useState } from "react";
import {
  endOfMoveInMonth,
  proRataDayCount,
  suggestProRata,
} from "../domain/pro-rata";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function formatGbp(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `£${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function nextMonthName(startDate: string): string {
  const d = new Date(startDate + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return "next month";
  const nextIdx = (d.getUTCMonth() + 1) % 12;
  return MONTHS[nextIdx];
}

// Two independent toggles:
//   1. Pro-rate first month — sets pro_rata_amount (partial-days for move-in month)
//   2. Tenant paid first full month in advance — sets prepaid_first_full_month
//
// Either, both, or neither can be enabled. The auto-suggestion for the pro-rata
// amount keeps tracking start_date / rent_pcm changes until the agent edits the
// number manually.
export function ProRataField({
  startDate,
  rentPcm,
  proRataValue,
  onProRataChange,
  prepaidValue,
  onPrepaidChange,
}: {
  startDate: string | undefined;
  rentPcm: number | undefined;
  proRataValue: number | null;
  onProRataChange: (next: number | null) => void;
  prepaidValue: boolean;
  onPrepaidChange: (next: boolean) => void;
}) {
  const proRataEnabled = proRataValue != null;
  const [proRataDirty, setProRataDirty] = useState(false);
  const lastSuggestionRef = useRef<number | null>(null);

  // Whenever start_date or rent_pcm change, refresh the pro-rata suggestion —
  // unless the agent has edited the amount manually, in which case keep their value.
  useEffect(() => {
    if (!proRataEnabled) return;
    if (!startDate || !rentPcm || rentPcm <= 0) return;
    const suggestion = suggestProRata(startDate, rentPcm);
    lastSuggestionRef.current = suggestion;
    if (!proRataDirty) onProRataChange(suggestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, rentPcm, proRataEnabled]);

  const handleProRataToggle = (on: boolean) => {
    if (on) {
      setProRataDirty(false);
      const suggestion =
        startDate && rentPcm && rentPcm > 0 ? suggestProRata(startDate, rentPcm) : 0;
      lastSuggestionRef.current = suggestion;
      onProRataChange(suggestion);
    } else {
      setProRataDirty(false);
      onProRataChange(null);
    }
  };

  const handleAmountChange = (raw: string) => {
    setProRataDirty(true);
    const n = Number(raw);
    onProRataChange(Number.isFinite(n) && n >= 0 ? n : 0);
  };

  const days = startDate ? proRataDayCount(startDate) : 0;
  const moveInEnd = startDate ? endOfMoveInMonth(startDate) : null;
  const proRataAmount = Number(proRataValue) || 0;
  const advanceAmount = prepaidValue ? rentPcm ?? 0 : 0;
  const total = proRataAmount + advanceAmount;
  const nextMonth = startDate ? nextMonthName(startDate) : "next month";

  return (
    <div className="rounded-lg border border-border bg-surface-inset/40 p-3 space-y-3">
      {/* Toggle 1 — pro-rate first month */}
      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={proRataEnabled}
          onChange={(e) => handleProRataToggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border text-brand focus:ring-brand/30"
        />
        <span className="text-sm text-foreground">
          Pro-rate first month
          <span className="block text-[11px] text-foreground-muted">
            Tenant pays only for the days remaining in the move-in month.
          </span>
        </span>
      </label>

      {proRataEnabled && (
        <div className="space-y-2 pl-6">
          {startDate && moveInEnd ? (
            <p className="text-[11px] text-foreground-secondary">
              Move-in <span className="font-medium text-foreground">{formatDate(startDate)}</span>
              {" "}· covers {days} day{days === 1 ? "" : "s"} ({formatDate(startDate)} – {formatDate(moveInEnd)})
            </p>
          ) : (
            <p className="text-[11px] text-amber-700">Set a start date and rent to see the suggested pro-rata.</p>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground">First-period amount (£)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={proRataValue ?? ""}
              onChange={(e) => handleAmountChange(e.target.value)}
              className={inputCls}
            />
            <span className="text-[11px] text-foreground-muted">
              Auto-calculated as rent ÷ days in {startDate ? MONTHS[new Date(startDate + "T00:00:00Z").getUTCMonth()] : "the move-in month"} × days remaining.
              Editable.
            </span>
          </label>
        </div>
      )}

      {/* Toggle 2 — first full month paid in advance */}
      <label className="flex items-start gap-2 cursor-pointer select-none border-t border-border/50 pt-3">
        <input
          type="checkbox"
          checked={prepaidValue}
          onChange={(e) => onPrepaidChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border text-brand focus:ring-brand/30"
        />
        <span className="text-sm text-foreground">
          Tenant paid first full month in advance
          <span className="block text-[11px] text-foreground-muted">
            {nextMonth} rent collected upfront at signing.
            {rentPcm && rentPcm > 0 ? ` £${rentPcm.toLocaleString()}.` : ""}
          </span>
        </span>
      </label>

      {(proRataEnabled || prepaidValue) && rentPcm && rentPcm > 0 && (
        <p className="text-[11px] text-foreground-secondary border-t border-border/50 pt-2">
          At move-in:
          {proRataEnabled ? ` ${formatGbp(proRataAmount)} pro-rata` : ""}
          {proRataEnabled && prepaidValue ? " +" : ""}
          {prepaidValue ? ` £${rentPcm.toLocaleString()} (${nextMonth} advance)` : ""}
          {" "}= <span className="font-medium text-foreground">£{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </p>
      )}
    </div>
  );
}

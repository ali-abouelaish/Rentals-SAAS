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

// Auto-suggest the pro-rata amount based on start_date + rent_pcm, but stop
// overriding once the agent has manually edited the field.
export function ProRataField({
  startDate,
  rentPcm,
  value,
  onChange,
}: {
  startDate: string | undefined;
  rentPcm: number | undefined;
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  const enabled = value != null;
  const [dirty, setDirty] = useState(false);
  const lastSuggestionRef = useRef<number | null>(null);

  // Whenever start_date or rent_pcm change, refresh the suggestion — unless the
  // agent has edited the amount manually, in which case keep their value.
  useEffect(() => {
    if (!enabled) return;
    if (!startDate || !rentPcm || rentPcm <= 0) return;
    const suggestion = suggestProRata(startDate, rentPcm);
    lastSuggestionRef.current = suggestion;
    if (!dirty) onChange(suggestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, rentPcm, enabled]);

  const handleToggle = (on: boolean) => {
    if (on) {
      setDirty(false);
      const suggestion =
        startDate && rentPcm && rentPcm > 0 ? suggestProRata(startDate, rentPcm) : 0;
      lastSuggestionRef.current = suggestion;
      onChange(suggestion);
    } else {
      setDirty(false);
      onChange(null);
    }
  };

  const handleAmountChange = (raw: string) => {
    setDirty(true);
    const n = Number(raw);
    onChange(Number.isFinite(n) && n >= 0 ? n : 0);
  };

  const days = startDate ? proRataDayCount(startDate) : 0;
  const moveInEnd = startDate ? endOfMoveInMonth(startDate) : null;
  const total = (Number(value) || 0) + (rentPcm ?? 0);
  const nextMonth = startDate ? nextMonthName(startDate) : "next month";

  return (
    <div className="rounded-lg border border-border bg-surface-inset/40 p-3 space-y-2">
      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => handleToggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border text-brand focus:ring-brand/30"
        />
        <span className="text-sm text-foreground">
          Pro-rate first month + collect next month in advance
          <span className="block text-[11px] text-foreground-muted">
            Tenant pays for the days remaining in the move-in month plus {nextMonth} upfront.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="space-y-2 pt-1">
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
              value={value ?? ""}
              onChange={(e) => handleAmountChange(e.target.value)}
              className={inputCls}
            />
            <span className="text-[11px] text-foreground-muted">
              Auto-calculated as rent ÷ days in {startDate ? MONTHS[new Date(startDate + "T00:00:00Z").getUTCMonth()] : "the move-in month"} × days remaining.
              Editable.
            </span>
          </label>

          {rentPcm && rentPcm > 0 && (
            <p className="text-[11px] text-foreground-secondary">
              At move-in: {formatGbp(Number(value) || 0)} pro-rata + £{rentPcm.toLocaleString()} ({nextMonth} advance)
              {" "}= <span className="font-medium text-foreground">£{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

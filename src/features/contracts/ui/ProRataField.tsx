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

// Move-in payment mode. Encoded as the pair { pro_rata_amount, prepaid_first_full_month }:
//   none      → pro_rata_amount = null, prepaid_first_full_month = false
//   pro_rata  → pro_rata_amount = <calc>, prepaid_first_full_month = false
//   deferred  → pro_rata_amount = <calc>, prepaid_first_full_month = true
type Mode = "none" | "pro_rata" | "deferred";

function modeFromValues(
  proRataValue: number | null,
  prepaidValue: boolean
): Mode {
  if (prepaidValue) return "deferred";
  if (proRataValue != null) return "pro_rata";
  return "none";
}

// Mutually-exclusive radio for the move-in payment pattern. Under post-2025
// rules an agency may not collect more than one month of rent at move-in, so
// the old "pro-rata + next month in advance" combination is illegal. Each
// option here collects exactly one move-in payment.
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
  const mode = modeFromValues(proRataValue, prepaidValue);
  const [proRataDirty, setProRataDirty] = useState(false);
  const lastSuggestionRef = useRef<number | null>(null);

  // Keep the suggested pro-rata amount tracking start_date / rent_pcm in both
  // pro_rata and deferred modes (the deferred mode uses the same number as
  // the future true-up). If the agent edits the amount manually, stop tracking.
  useEffect(() => {
    if (mode === "none") return;
    if (!startDate || !rentPcm || rentPcm <= 0) return;
    const suggestion = suggestProRata(startDate, rentPcm);
    lastSuggestionRef.current = suggestion;
    if (!proRataDirty) onProRataChange(suggestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, rentPcm, mode]);

  const setMode = (next: Mode) => {
    if (next === "none") {
      setProRataDirty(false);
      onProRataChange(null);
      onPrepaidChange(false);
      return;
    }

    const suggestion =
      startDate && rentPcm && rentPcm > 0 ? suggestProRata(startDate, rentPcm) : 0;
    lastSuggestionRef.current = suggestion;
    setProRataDirty(false);
    // Preserve the current amount if one is already set; otherwise drop in the suggestion.
    onProRataChange(proRataValue ?? suggestion);
    onPrepaidChange(next === "deferred");
  };

  const handleAmountChange = (raw: string) => {
    setProRataDirty(true);
    const n = Number(raw);
    onProRataChange(Number.isFinite(n) && n >= 0 ? n : 0);
  };

  const days = startDate ? proRataDayCount(startDate) : 0;
  const moveInEnd = startDate ? endOfMoveInMonth(startDate) : null;
  const proRataAmount = Number(proRataValue) || 0;
  const nextMonth = startDate ? nextMonthName(startDate) : "next month";
  const moveInMonth =
    startDate && !Number.isNaN(new Date(startDate + "T00:00:00Z").getTime())
      ? MONTHS[new Date(startDate + "T00:00:00Z").getUTCMonth()]
      : "the move-in month";

  return (
    <fieldset className="rounded-lg border border-border bg-surface-inset/40 p-3 space-y-3">
      <legend className="px-1 text-xs font-medium text-foreground">
        Move-in payment
        <span className="ml-1 text-foreground-muted font-normal">
          (max 1 month's rent collected at signing)
        </span>
      </legend>

      <RadioRow
        name="move-in-mode"
        value="none"
        checked={mode === "none"}
        onChange={() => setMode("none")}
        title="No special arrangement"
        subtitle="Full calendar months from move-in date onward."
      />

      <RadioRow
        name="move-in-mode"
        value="pro_rata"
        checked={mode === "pro_rata"}
        onChange={() => setMode("pro_rata")}
        title="Pro-rate first month"
        subtitle={
          startDate
            ? `Tenant pays only for ${days} day${days === 1 ? "" : "s"} of ${moveInMonth} at signing. Full months from ${nextMonth} 1st.`
            : "Tenant pays only for the days remaining in the move-in month at signing."
        }
      />

      <RadioRow
        name="move-in-mode"
        value="deferred"
        checked={mode === "deferred"}
        onChange={() => setMode("deferred")}
        title="First full month at signing, deferred true-up"
        subtitle={`Tenant pays £${rentPcm ? rentPcm.toLocaleString() : "rent"} at signing (recorded against ${nextMonth}). Pro-rata true-up for ${moveInMonth} is collected on 1 ${nextMonth}.`}
      />

      {mode !== "none" && (
        <div className="space-y-2 pl-6 pt-1 border-t border-border/50">
          {startDate && moveInEnd ? (
            <p className="text-[11px] text-foreground-secondary">
              Move-in <span className="font-medium text-foreground">{formatDate(startDate)}</span>
              {" "}· partial period covers {days} day{days === 1 ? "" : "s"} ({formatDate(startDate)} – {formatDate(moveInEnd)})
            </p>
          ) : (
            <p className="text-[11px] text-amber-700">Set a start date and rent to see the suggested pro-rata.</p>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground">
              {mode === "pro_rata"
                ? "First-period amount (£)"
                : "Deferred true-up amount (£)"}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={proRataValue ?? ""}
              onChange={(e) => handleAmountChange(e.target.value)}
              className={inputCls}
            />
            <span className="text-[11px] text-foreground-muted">
              {mode === "pro_rata"
                ? `Auto-calculated as rent ÷ days in ${moveInMonth} × days remaining. Editable.`
                : `Auto-calculated; collected on 1 ${nextMonth}. Editable.`}
            </span>
          </label>

          {rentPcm && rentPcm > 0 && (
            <p className="text-[11px] text-foreground-secondary">
              {mode === "pro_rata" ? (
                <>
                  Collected at signing:{" "}
                  <span className="font-medium text-foreground">{formatGbp(proRataAmount)}</span>
                </>
              ) : (
                <>
                  Collected at signing:{" "}
                  <span className="font-medium text-foreground">£{rentPcm.toLocaleString()}</span>
                  {" "}· True-up on 1 {nextMonth}:{" "}
                  <span className="font-medium text-foreground">{formatGbp(proRataAmount)}</span>
                </>
              )}
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}

function RadioRow({
  name,
  value,
  checked,
  onChange,
  title,
  subtitle,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer select-none">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 border-border text-brand focus:ring-brand/30"
      />
      <span className="text-sm text-foreground">
        {title}
        <span className="block text-[11px] text-foreground-muted">{subtitle}</span>
      </span>
    </label>
  );
}

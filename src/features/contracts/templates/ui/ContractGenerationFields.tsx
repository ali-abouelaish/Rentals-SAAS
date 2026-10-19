"use client";

// The contract-terms + template-fields form shared by "Convert to tenancy" and
// "Create contract from template". One component and one schema
// (contractGenerationFormSchema), so the two entry points can't drift apart on
// what's required — they previously disagreed on whether rent could be £0.

import { useFieldArray, useFormContext } from "react-hook-form";
import { AlertCircle, Info } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import type { ContractGenerationFormValues } from "../domain/schemas";
import type { ManualFieldPrompt } from "../domain/types";

export const fieldCls = (hasError: boolean) =>
  cn(
    "w-full rounded-lg border bg-surface-inset px-2 py-2.5 md:py-1.5 text-base md:text-sm focus:outline-none focus:ring-2",
    hasError
      ? "border-red-400 focus:ring-red-500/20 focus:border-red-500"
      : "border-border focus:ring-brand/20 focus:border-brand",
  );

export function Hint({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-[11px] leading-snug text-foreground-muted">
      {children}
    </p>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-1 text-[11px] text-red-500">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

function LabelWithTip({ htmlFor, children, tip }: { htmlFor: string; children: React.ReactNode; tip?: string }) {
  return (
    <div className="flex items-center gap-1">
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
        {children}
      </label>
      {tip && (
        <Tooltip content={tip}>
          <button type="button" className="text-foreground-muted hover:text-foreground" aria-label="More information">
            <Info className="h-3 w-3" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

/** Start / end / rent / deposit. */
export function ContractTermsFields({ idPrefix, disabled }: { idPrefix: string; disabled?: boolean }) {
  const {
    register,
    formState: { errors },
  } = useFormContext<ContractGenerationFormValues>();

  const field = (name: "start_date" | "expiry_date" | "rent_pcm" | "deposit") => ({
    id: `${idPrefix}-${name}`,
    hintId: `${idPrefix}-${name}-hint`,
    errorId: `${idPrefix}-${name}-error`,
    error: errors[name]?.message,
  });
  const start = field("start_date");
  const expiry = field("expiry_date");
  const rent = field("rent_pcm");
  const deposit = field("deposit");

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <LabelWithTip
          htmlFor={start.id}
          tip="Printed on the contract, and starts the 30-day clock for protecting the deposit."
        >
          Start date *
        </LabelWithTip>
        <Hint id={start.hintId}>First day of the tenancy.</Hint>
        <input
          id={start.id}
          type="date"
          disabled={disabled}
          aria-invalid={!!start.error}
          aria-describedby={`${start.hintId} ${start.errorId}`}
          className={fieldCls(!!start.error)}
          {...register("start_date")}
        />
        <FieldError id={start.errorId} message={start.error} />
      </div>
      <div className="space-y-1">
        <LabelWithTip
          htmlFor={expiry.id}
          tip="Set this for a fixed term. The room shows as available again from this date."
        >
          End date (optional)
        </LabelWithTip>
        <Hint id={expiry.hintId}>Leave blank for a rolling tenancy.</Hint>
        <input
          id={expiry.id}
          type="date"
          disabled={disabled}
          aria-invalid={!!expiry.error}
          aria-describedby={`${expiry.hintId} ${expiry.errorId}`}
          className={fieldCls(!!expiry.error)}
          {...register("expiry_date")}
        />
        <FieldError id={expiry.errorId} message={expiry.error} />
      </div>
      <div className="space-y-1">
        <LabelWithTip htmlFor={rent.id} tip="The agreed rent. Saved on the contract and used for rent collection and arrears.">
          Rent PCM (£) *
        </LabelWithTip>
        <Hint id={rent.hintId}>Whole pounds per month, e.g. 650.</Hint>
        <input
          id={rent.id}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          disabled={disabled}
          aria-invalid={!!rent.error}
          aria-describedby={`${rent.hintId} ${rent.errorId}`}
          className={fieldCls(!!rent.error)}
          {...register("rent_pcm")}
        />
        <FieldError id={rent.errorId} message={rent.error} />
      </div>
      <div className="space-y-1">
        <LabelWithTip htmlFor={deposit.id} tip="The deposit taken for this tenancy — it must be protected within 30 days of the start date.">
          Deposit (£) *
        </LabelWithTip>
        <Hint id={deposit.hintId}>Whole pounds. Enter 0 if there is no deposit.</Hint>
        <input
          id={deposit.id}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          disabled={disabled}
          aria-invalid={!!deposit.error}
          aria-describedby={`${deposit.hintId} ${deposit.errorId}`}
          className={fieldCls(!!deposit.error)}
          {...register("deposit")}
        />
        <FieldError id={deposit.errorId} message={deposit.error} />
      </div>
    </div>
  );
}

const FORMAT_HINTS: Record<string, string> = {
  date: "Pick the date — it's printed as e.g. 10 November 2026.",
  currency_gbp: "Amount in pounds, e.g. 650 — printed as £650.",
  number: "Numbers only.",
  multiline: "Line breaks are kept on the contract. Max 2000 characters.",
  text: "Printed exactly as typed. Max 2000 characters.",
};

/** One input per manual key on the chosen template. */
export function ManualFieldsSection({ idPrefix, disabled }: { idPrefix: string; disabled?: boolean }) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ContractGenerationFormValues>();
  const { fields } = useFieldArray({ control, name: "manual" });

  if (fields.length === 0) return null;

  return (
    <div className="space-y-3 pt-2 border-t border-border">
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-foreground-secondary uppercase tracking-wide">
          Template-specific fields
        </p>
        <Hint>These are printed on the contract PDF, so all are required.</Hint>
      </div>
      {fields.map((f, i) => {
        const id = `${idPrefix}-manual-${i}`;
        const hintId = `${id}-hint`;
        const errorId = `${id}-error`;
        const error = errors.manual?.[i]?.value?.message;
        const common = {
          id,
          disabled,
          "aria-invalid": !!error,
          "aria-describedby": `${hintId} ${errorId}`,
          className: fieldCls(!!error),
          ...register(`manual.${i}.value` as const),
        };
        return (
          <div key={f.id} className="space-y-1">
            <label htmlFor={id} className="text-xs font-medium text-foreground">
              {f.label} *
            </label>
            <Hint id={hintId}>{FORMAT_HINTS[f.format] ?? FORMAT_HINTS.text}</Hint>
            {f.format === "multiline" ? (
              <textarea rows={3} {...common} />
            ) : f.format === "date" ? (
              <input type="date" {...common} />
            ) : (
              <input type="text" inputMode={f.format === "currency_gbp" || f.format === "number" ? "decimal" : undefined} {...common} />
            )}
            <FieldError id={errorId} message={error} />
          </div>
        );
      })}
    </div>
  );
}

/** Form rows for a template's manual prompts, with defaults filled in. */
export function manualRowsFor(prompts: ManualFieldPrompt[]): ContractGenerationFormValues["manual"] {
  return prompts.map((p) => ({
    key: p.key,
    label: p.label,
    format: p.format,
    // A date input only accepts yyyy-mm-dd; any other default would show blank.
    value: p.format === "date" && p.default_value && !/^\d{4}-\d{2}-\d{2}$/.test(p.default_value) ? "" : p.default_value ?? "",
  }));
}

/** Form values → the server's manualValues record. */
export function manualValuesFrom(rows: ContractGenerationFormValues["manual"]): Record<string, string> {
  return Object.fromEntries(rows.map((r) => [r.key, r.value.trim()]));
}

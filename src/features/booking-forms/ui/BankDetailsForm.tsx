"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Landmark, ShieldCheck, Save, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { bankDetailsSchema, type BankDetailsValues } from "../domain/schemas";
import { updateBankDetailsForForm } from "../actions/bank-details";
import type { BookingForm, FormBankDetails } from "../domain/types";

const inputCls =
  "w-full rounded-xl border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50";

const selectCls =
  "h-10 w-full rounded-xl border border-border bg-surface-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/50";

interface BankDetailsFormProps {
  forms: BookingForm[];
  detailsByFormId: Record<string, FormBankDetails>;
}

function emptyValues(): BankDetailsValues {
  return {
    account_holder_name: "",
    account_number: "",
    sort_code: "",
    bank_name: "",
    payment_reference_hint: "",
  };
}

function toValues(d: FormBankDetails | undefined): BankDetailsValues {
  if (!d) return emptyValues();
  return {
    account_holder_name: d.account_holder_name ?? "",
    account_number: d.account_number ?? "",
    sort_code: d.sort_code ?? "",
    bank_name: d.bank_name ?? "",
    payment_reference_hint: d.payment_reference_hint ?? "",
  };
}

export function BankDetailsForm({ forms, detailsByFormId }: BankDetailsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedFormId, setSelectedFormId] = useState<string | null>(forms[0]?.id ?? null);
  const [localDetails, setLocalDetails] =
    useState<Record<string, FormBankDetails | undefined>>(detailsByFormId);

  const selectedForm = useMemo(
    () => forms.find((f) => f.id === selectedFormId) ?? null,
    [forms, selectedFormId]
  );

  const selectedDetails = selectedFormId ? localDetails[selectedFormId] : undefined;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BankDetailsValues>({
    resolver: zodResolver(bankDetailsSchema),
    defaultValues: toValues(selectedDetails),
  });

  useEffect(() => {
    reset(toValues(selectedDetails));
  }, [selectedFormId, selectedDetails, reset]);

  const configured = Boolean(
    selectedDetails?.account_holder_name ||
      selectedDetails?.account_number ||
      selectedDetails?.sort_code ||
      selectedDetails?.bank_name
  );

  const onSubmit = (values: BankDetailsValues) => {
    if (!selectedFormId) return;
    startTransition(async () => {
      try {
        await updateBankDetailsForForm(selectedFormId, values);
        setLocalDetails((prev) => ({
          ...prev,
          [selectedFormId]: {
            form_id: selectedFormId,
            tenant_id: selectedDetails?.tenant_id ?? "",
            account_holder_name: values.account_holder_name ?? null,
            account_number: values.account_number ?? null,
            sort_code: values.sort_code ?? null,
            bank_name: values.bank_name ?? null,
            payment_reference_hint: values.payment_reference_hint ?? null,
            updated_at: new Date().toISOString(),
          },
        }));
        toast.success("Bank details saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save bank details");
      }
    });
  };

  if (forms.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading text-foreground">Bank Details</h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Bank details attach to each booking form, so every portfolio can point to its own account.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">No booking forms yet</p>
            <p className="mt-0.5 text-amber-800">
              Create a booking form first, then come back here to set its bank details.{" "}
              <Link href="/settings/booking-forms" className="underline font-medium hover:text-amber-950">
                Open booking forms →
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading text-foreground">Bank Details</h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Bank details attach to each booking form — applicants see the account that matches the portfolio they&apos;re applying through.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold self-start sm:self-auto",
            configured
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          )}
        >
          <ShieldCheck size={12} />
          {configured ? "Configured" : "Not configured yet"}
        </span>
      </div>

      {/* ── Form picker ── */}
      <div className="rounded-bento bg-surface-card shadow-bento p-5">
        <label
          htmlFor="bank-details-form-picker"
          className="block text-sm font-medium text-foreground mb-1.5"
        >
          Booking form
        </label>
        <select
          id="bank-details-form-picker"
          className={selectCls}
          value={selectedFormId ?? ""}
          onChange={(e) => setSelectedFormId(e.target.value || null)}
        >
          {forms.map((f) => {
            const configuredMark = localDetails[f.id]?.account_number ? "✓" : "○";
            const portfolio = f.portfolio?.name ? ` · ${f.portfolio.name}` : "";
            return (
              <option key={f.id} value={f.id}>
                {configuredMark}  {f.name}{portfolio}
              </option>
            );
          })}
        </select>
        <p className="text-xs text-foreground-secondary mt-1.5">
          Pick the form you want to edit bank details for. ✓ means bank details are already saved; ○ means empty.
        </p>
      </div>

      {/* ── Info banner ── */}
      <div className="rounded-bento bg-surface-card shadow-bento p-5 flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
          <Landmark size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Payment destination</p>
          <p className="text-xs text-foreground-secondary mt-0.5 leading-relaxed">
            These details appear on the public booking form alongside each room&apos;s holding deposit amount.
            They are never shown to logged-out visitors outside the booking flow.
          </p>
        </div>
      </div>

      {/* ── Form ── */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-bento bg-surface-card shadow-bento overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            Account for {selectedForm?.name ?? "form"}
            {selectedForm?.portfolio?.name && (
              <span className="ml-2 text-xs font-normal text-foreground-secondary">
                · {selectedForm.portfolio.name}
              </span>
            )}
          </h2>
          <p className="text-xs text-foreground-secondary mt-0.5">
            All fields are optional — fill in whichever you want applicants to see.
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Account holder */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Account holder name
            </label>
            <input
              {...register("account_holder_name")}
              placeholder="Harbor Ops Ltd"
              className={cn(inputCls, errors.account_holder_name ? "border-red-400" : "border-border")}
            />
            {errors.account_holder_name && (
              <p className="text-xs text-red-600 mt-1">{errors.account_holder_name.message}</p>
            )}
          </div>

          {/* Bank + sort code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Bank name</label>
              <input
                {...register("bank_name")}
                placeholder="Barclays"
                className={cn(inputCls, errors.bank_name ? "border-red-400" : "border-border")}
              />
              {errors.bank_name && (
                <p className="text-xs text-red-600 mt-1">{errors.bank_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Sort code</label>
              <input
                {...register("sort_code")}
                placeholder="12-34-56"
                inputMode="numeric"
                className={cn(
                  inputCls,
                  "font-mono",
                  errors.sort_code ? "border-red-400" : "border-border"
                )}
              />
              {errors.sort_code && (
                <p className="text-xs text-red-600 mt-1">{errors.sort_code.message}</p>
              )}
            </div>
          </div>

          {/* Account number */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Account number
            </label>
            <input
              {...register("account_number")}
              placeholder="12345678"
              inputMode="numeric"
              className={cn(
                inputCls,
                "font-mono",
                errors.account_number ? "border-red-400" : "border-border"
              )}
            />
            {errors.account_number && (
              <p className="text-xs text-red-600 mt-1">{errors.account_number.message}</p>
            )}
          </div>

          {/* Reference hint */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Payment reference hint
            </label>
            <input
              {...register("payment_reference_hint")}
              placeholder="e.g. Use your full name + room number as the reference"
              className={cn(
                inputCls,
                errors.payment_reference_hint ? "border-red-400" : "border-border"
              )}
            />
            {errors.payment_reference_hint && (
              <p className="text-xs text-red-600 mt-1">{errors.payment_reference_hint.message}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-surface-inset/40">
          <button
            type="submit"
            disabled={isPending || !selectedFormId}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-brand-fg hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <Save size={14} />
            {isPending ? "Saving…" : "Save bank details"}
          </button>
        </div>
      </form>
    </div>
  );
}

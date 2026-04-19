"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Landmark, ShieldCheck, Save } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { bankDetailsSchema, type BankDetailsValues } from "../domain/schemas";
import { updateBankDetails } from "../actions/bank-details";
import type { TenantBankDetails } from "../domain/types";

const inputCls =
  "w-full rounded-xl border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50";

interface BankDetailsFormProps {
  initial: TenantBankDetails | null;
}

export function BankDetailsForm({ initial }: BankDetailsFormProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BankDetailsValues>({
    resolver: zodResolver(bankDetailsSchema),
    defaultValues: {
      account_holder_name: initial?.account_holder_name ?? "",
      account_number: initial?.account_number ?? "",
      sort_code: initial?.sort_code ?? "",
      bank_name: initial?.bank_name ?? "",
      payment_reference_hint: initial?.payment_reference_hint ?? "",
    },
  });

  const configured = Boolean(
    initial?.account_holder_name ||
      initial?.account_number ||
      initial?.sort_code ||
      initial?.bank_name
  );

  const onSubmit = (values: BankDetailsValues) => {
    startTransition(async () => {
      try {
        await updateBankDetails(values);
        toast.success("Bank details saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save bank details");
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading text-foreground">Bank Details</h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Shown on every room&apos;s booking form so applicants know where to send their holding deposit.
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
          <h2 className="text-base font-semibold text-foreground">Account</h2>
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
            disabled={isPending}
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

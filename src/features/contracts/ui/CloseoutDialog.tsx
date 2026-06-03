"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Sparkles, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { closeoutSchema, type CloseoutValues } from "../domain/schemas";
import { END_REASON_LABELS } from "../domain/types";
import { closeoutContract } from "../actions/contracts";
import { estimateContractArrears, type ArrearsEstimate } from "../actions/rent-payments";
import type { TenancyEntry } from "../domain/history";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const selectCls = inputCls;
const textareaCls =
  "min-h-[88px] w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function FormField({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function CloseoutDialog({
  contract,
  open,
  onClose,
  onSuccess,
}: {
  contract: TenancyEntry;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const depositHeld = contract.depositPence ?? 0;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CloseoutValues>({
    resolver: zodResolver(closeoutSchema),
    defaultValues: {
      actual_end_date: today,
      end_reason: "tenant_notice",
      arrears_at_end: 0,
      would_relet: null,
      end_notes: "",
      deposit_returned: depositHeld,
      deposit_returned_at: today,
      deposit_release_notes: "",
    },
  });

  const watchedEndDate = watch("actual_end_date");
  const watchedArrears = watch("arrears_at_end");
  const [estimate, setEstimate] = useState<ArrearsEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  // Tracks whether the user has manually overridden the suggested arrears /
  // deposit-returned values. Once overridden, we stop auto-overwriting on
  // date or arrears changes.
  const userOverrodeRef = useRef(false);
  const userOverrodeDepositRef = useRef(false);

  useEffect(() => {
    if (open) {
      userOverrodeRef.current = false;
      userOverrodeDepositRef.current = false;
    }
  }, [open, contract.contractId]);

  // Auto-suggest deposit returned = max(deposit − arrears, 0), capped at deposit.
  // Stops once the user edits the field manually.
  useEffect(() => {
    if (!open || userOverrodeDepositRef.current) return;
    const arrears = Number(watchedArrears) || 0;
    const suggested = Math.max(0, Math.min(depositHeld, depositHeld - arrears));
    setValue("deposit_returned", suggested, { shouldDirty: false });
  }, [open, watchedArrears, depositHeld, setValue]);

  useEffect(() => {
    if (!open || !watchedEndDate) return;
    let cancelled = false;
    setEstimating(true);
    estimateContractArrears(contract.contractId, watchedEndDate)
      .then((est) => {
        if (cancelled) return;
        setEstimate(est);
        if (!userOverrodeRef.current) {
          setValue("arrears_at_end", est.arrears, { shouldDirty: false });
        }
      })
      .catch(() => {
        if (!cancelled) setEstimate(null);
      })
      .finally(() => {
        if (!cancelled) setEstimating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, watchedEndDate, contract.contractId, setValue]);

  const onSubmit = (values: CloseoutValues) => {
    startTransition(async () => {
      try {
        await closeoutContract(contract.contractId, values);
        toast.success("Tenancy closed out");
        reset();
        onClose();
        onSuccess?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to close out tenancy");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Close out tenancy — {contract.tenant.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <FormField
            label="Actual move-out date *"
            htmlFor="closeout-end-date"
            error={errors.actual_end_date?.message}
          >
            <input
              id="closeout-end-date"
              type="date"
              {...register("actual_end_date")}
              className={inputCls}
            />
          </FormField>

          <FormField
            label="End reason *"
            htmlFor="closeout-reason"
            error={errors.end_reason?.message}
          >
            <select id="closeout-reason" {...register("end_reason")} className={selectCls}>
              {Object.entries(END_REASON_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Arrears at end (£)"
            htmlFor="closeout-arrears"
            error={errors.arrears_at_end?.message}
          >
            <input
              id="closeout-arrears"
              type="number"
              min="0"
              step="1"
              {...register("arrears_at_end", {
                onChange: () => {
                  userOverrodeRef.current = true;
                },
              })}
              className={inputCls}
            />
            <p className="text-[11px] text-foreground-muted flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-brand" />
              {estimating
                ? "Calculating from rent payments…"
                : estimate
                  ? (
                    <>
                      Suggested <span className="font-medium text-foreground">£{estimate.arrears.toLocaleString()}</span>
                      {" "}
                      ({estimate.monthsCovered} mo × £{estimate.rentPcm.toLocaleString()} expected,
                      {" "}
                      £{estimate.paid.toLocaleString()} paid)
                      {userOverrodeRef.current && estimate.arrears !== watch("arrears_at_end") && (
                        <button
                          type="button"
                          onClick={() => {
                            userOverrodeRef.current = false;
                            setValue("arrears_at_end", estimate.arrears, { shouldDirty: true });
                          }}
                          className="ml-1 text-brand hover:underline"
                        >
                          Use suggested
                        </button>
                      )}
                    </>
                  )
                  : "Auto-calculation unavailable"}
            </p>
          </FormField>

          <FormField label="Would re-let to this tenant?">
            <Controller
              name="would_relet"
              control={control}
              render={({ field }) => (
                <div className="flex gap-2">
                  {[
                    { v: true, label: "Yes" },
                    { v: false, label: "No" },
                    { v: null, label: "Unsure" },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.label}
                      onClick={() => field.onChange(opt.v)}
                      className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                        field.value === opt.v
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-border bg-surface-inset text-foreground-secondary hover:bg-surface-card"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            />
          </FormField>

          <FormField
            label="Internal notes"
            htmlFor="closeout-notes"
            error={errors.end_notes?.message}
          >
            <textarea
              id="closeout-notes"
              {...register("end_notes")}
              className={textareaCls}
              placeholder="Damage, cleaning, why you would/wouldn't re-let…"
            />
          </FormField>

          {depositHeld > 0 && (
            <div className="space-y-3 pt-3 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                Deposit release
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label={`Returned (£) of £${depositHeld.toLocaleString()}`}
                  htmlFor="closeout-deposit-returned"
                  error={errors.deposit_returned?.message}
                >
                  <input
                    id="closeout-deposit-returned"
                    type="number"
                    min="0"
                    max={depositHeld}
                    step="1"
                    {...register("deposit_returned", {
                      onChange: () => {
                        userOverrodeDepositRef.current = true;
                      },
                    })}
                    className={inputCls}
                  />
                </FormField>
                <FormField
                  label="Released on"
                  htmlFor="closeout-deposit-date"
                  error={errors.deposit_returned_at?.message}
                >
                  <input
                    id="closeout-deposit-date"
                    type="date"
                    {...register("deposit_returned_at")}
                    className={inputCls}
                  />
                </FormField>
              </div>
              <p className="text-[11px] text-foreground-muted flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-brand" />
                Suggested £{Math.max(0, depositHeld - (Number(watchedArrears) || 0)).toLocaleString()} (deposit − arrears).
                Leave at £{depositHeld.toLocaleString()} for full release, £0 to retain in full.
              </p>
              <FormField
                label="Deposit notes / deductions"
                htmlFor="closeout-deposit-notes"
                error={errors.deposit_release_notes?.message}
              >
                <textarea
                  id="closeout-deposit-notes"
                  {...register("deposit_release_notes")}
                  className={textareaCls}
                  placeholder="e.g. £350 cleaning, £200 carpet damage…"
                />
              </FormField>

              {contract.depositScheme === "mydeposits" && (
                <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-inset p-3">
                  <ShieldCheck className="h-4 w-4 text-brand mt-0.5 shrink-0" />
                  <div className="space-y-1.5">
                    <p className="text-xs text-foreground-secondary">
                      This deposit is protected with mydeposits. Recording a return here is for your
                      records — start the formal release request in Deposit Protection.
                    </p>
                    <Button asChild variant="secondary" size="sm">
                      <Link href="/deposits">
                        Start release request
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              Close tenancy
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

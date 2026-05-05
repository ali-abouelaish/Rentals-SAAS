"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { recordRentPayment } from "@/features/contracts/actions/rent-payments";
import {
  isMoveInMonth,
  endOfMoveInMonth,
} from "@/features/contracts/domain/pro-rata";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const textareaCls =
  "min-h-[72px] w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const schema = z.object({
  period_year: z.coerce.number().int().min(2000).max(2100),
  period_month: z.coerce.number().int().min(1).max(12),
  amount: z.coerce.number().min(0, "Amount must be £0 or more"),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date is required"),
  notes: z.string().max(500).optional(),
});

type Values = z.infer<typeof schema>;

function todayIso(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function FormField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
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

export function RecordPaymentDialog({
  open,
  onClose,
  contractId,
  unitId,
  tenantName,
  rentPcm,
  startDate,
  proRataAmount = null,
}: {
  open: boolean;
  onClose: () => void;
  contractId: string;
  unitId: string;
  tenantName: string;
  rentPcm: number;
  startDate?: string;
  proRataAmount?: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const now = new Date();

  // Default the dialog to the move-in month when the contract has a pro-rata
  // first period and the move-in is in the past — that's the row most likely
  // being recorded next. Otherwise current calendar month.
  const moveIn = startDate ? new Date(startDate + "T00:00:00Z") : null;
  const defaultToMoveInMonth =
    proRataAmount != null &&
    moveIn != null &&
    !Number.isNaN(moveIn.getTime()) &&
    moveIn <= now;
  const defaultYear = defaultToMoveInMonth
    ? moveIn!.getUTCFullYear()
    : now.getUTCFullYear();
  const defaultMonth = defaultToMoveInMonth
    ? moveIn!.getUTCMonth() + 1
    : now.getUTCMonth() + 1;
  const defaultAmount = defaultToMoveInMonth ? Number(proRataAmount) : rentPcm;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      period_year: defaultYear,
      period_month: defaultMonth,
      amount: defaultAmount,
      paid_on: todayIso(),
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        period_year: defaultYear,
        period_month: defaultMonth,
        amount: defaultAmount,
        paid_on: todayIso(),
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contractId, rentPcm, proRataAmount, startDate]);

  // Re-default the amount when the agent switches the period — pro-rata for the
  // move-in month, otherwise rent_pcm. We only overwrite when the field still
  // holds one of the auto-defaults so a manually-typed amount isn't clobbered.
  const watchedYear = Number(watch("period_year"));
  const watchedMonth = Number(watch("period_month"));
  const watchedAmount = Number(watch("amount"));
  useEffect(() => {
    if (!open || !startDate || proRataAmount == null) return;
    const isMoveIn = isMoveInMonth(startDate, watchedYear, watchedMonth);
    const wantedAmount = isMoveIn ? Number(proRataAmount) : rentPcm;
    const stillAtAutoDefault =
      watchedAmount === rentPcm || watchedAmount === Number(proRataAmount);
    if (stillAtAutoDefault && watchedAmount !== wantedAmount) {
      setValue("amount", wantedAmount, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedYear, watchedMonth, open, proRataAmount, rentPcm, startDate]);

  const showProRataHint =
    proRataAmount != null &&
    startDate != null &&
    isMoveInMonth(startDate, watchedYear, watchedMonth);

  const onSubmit = (values: Values) => {
    startTransition(async () => {
      try {
        await recordRentPayment({
          contractId,
          unitId,
          periodYear: values.period_year,
          periodMonth: values.period_month,
          amount: values.amount,
          notes: values.notes,
          paidAt: values.paid_on,
        });
        toast.success("Payment recorded");
        reset();
        onClose();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to record payment");
      }
    });
  };

  const yearOptions = (() => {
    const y = now.getUTCFullYear();
    return [y - 2, y - 1, y, y + 1];
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record rent payment — {tenantName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Month *"
              htmlFor="rp-month"
              error={errors.period_month?.message}
            >
              <select id="rp-month" {...register("period_month")} className={inputCls}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Year *"
              htmlFor="rp-year"
              error={errors.period_year?.message}
            >
              <select id="rp-year" {...register("period_year")} className={inputCls}>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField
            label="Payment date *"
            htmlFor="rp-paid-on"
            error={errors.paid_on?.message}
          >
            <input
              id="rp-paid-on"
              type="date"
              max={todayIso()}
              {...register("paid_on")}
              className={inputCls}
            />
            <p className="text-[11px] text-foreground-muted">
              The exact day the rent was received.
            </p>
          </FormField>

          <FormField
            label="Amount (£) *"
            htmlFor="rp-amount"
            error={errors.amount?.message}
          >
            <input
              id="rp-amount"
              type="number"
              min="0"
              step="0.01"
              {...register("amount")}
              className={inputCls}
            />
            {showProRataHint ? (
              <p className="text-[11px] text-foreground-muted">
                Pro-rated first period: £{Number(proRataAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {" "}({startDate} – {endOfMoveInMonth(startDate!)}). Re-recording the
                same month overwrites the previous entry.
              </p>
            ) : (
              <p className="text-[11px] text-foreground-muted">
                Default is the contract rent £{rentPcm.toLocaleString()}/mo. Re-recording the same
                month overwrites the previous entry.
              </p>
            )}
          </FormField>

          <FormField
            label="Notes"
            htmlFor="rp-notes"
            error={errors.notes?.message}
          >
            <textarea
              id="rp-notes"
              {...register("notes")}
              className={textareaCls}
              placeholder="e.g. paid by bank transfer, partial — balance due 30th…"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { reset(); onClose(); }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              Record payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

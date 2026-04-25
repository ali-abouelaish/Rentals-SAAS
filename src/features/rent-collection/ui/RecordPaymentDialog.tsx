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
  notes: z.string().max(500).optional(),
});

type Values = z.infer<typeof schema>;

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
}: {
  open: boolean;
  onClose: () => void;
  contractId: string;
  unitId: string;
  tenantName: string;
  rentPcm: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const now = new Date();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      period_year: now.getUTCFullYear(),
      period_month: now.getUTCMonth() + 1,
      amount: rentPcm,
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        period_year: now.getUTCFullYear(),
        period_month: now.getUTCMonth() + 1,
        amount: rentPcm,
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contractId, rentPcm]);

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
            label="Amount (£) *"
            htmlFor="rp-amount"
            error={errors.amount?.message}
          >
            <input
              id="rp-amount"
              type="number"
              min="0"
              step="1"
              {...register("amount")}
              className={inputCls}
            />
            <p className="text-[11px] text-foreground-muted">
              Default is the contract rent £{rentPcm.toLocaleString()}/mo. Re-recording the same
              month overwrites the previous entry.
            </p>
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

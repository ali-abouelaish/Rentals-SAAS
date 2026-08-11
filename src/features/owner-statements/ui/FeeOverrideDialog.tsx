"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { setStatementFeeOverride } from "../actions/owner-statements";
import { feeOverrideSchema, type FeeOverrideInput } from "../domain/types";
import type { ManagementFeeType, OwnerStatementWithLines } from "../domain/types";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function describeFee(type: ManagementFeeType, percent: number | null, amount: number | null) {
  if (type === "percent" && percent != null) return `${Number(percent)}% of rent due`;
  if (type === "flat" && amount != null) return `£${Number(amount).toFixed(2)} per month`;
  return "no fee";
}

/**
 * Adjust the management fee for one period. The landlord's standing deal is
 * left alone unless "also update the default" is ticked, so fixing a single
 * month never quietly rewrites every future statement.
 */
export function FeeOverrideDialog({ statement }: { statement: OwnerStatementWithLines }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const owner = statement.owner;
  const isOverridden = statement.fee_override_type != null;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FeeOverrideInput>({
    resolver: zodResolver(feeOverrideSchema),
    defaultValues: {
      statement_id: statement.id,
      type: statement.fee_override_type ?? owner?.management_fee_type ?? "none",
      percent: statement.fee_override_percent ?? owner?.management_fee_percent ?? null,
      amount: statement.fee_override_amount ?? owner?.management_fee_amount ?? null,
      apply_to_default: false,
    },
  });

  const feeType = watch("type");

  const run = (fn: () => Promise<unknown>, success: string) => {
    startTransition(async () => {
      try {
        await fn();
        toast.success(success);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error("Could not update the fee", {
          description: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    });
  };

  const onSubmit = (values: FeeOverrideInput) =>
    run(() => setStatementFeeOverride(values), "Management fee updated for this period.");

  const onClear = () =>
    run(
      () =>
        setStatementFeeOverride({
          statement_id: statement.id,
          type: "none",
          apply_to_default: false,
          clear: true,
        }),
      "Reverted to the landlord's standing fee."
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
          title="Change the management fee for this period only"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Management fee for this period</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-foreground-muted -mt-1">
          {owner ? (
            <>
              This landlord&apos;s standing deal is{" "}
              <strong className="text-foreground-secondary">
                {describeFee(
                  owner.management_fee_type,
                  owner.management_fee_percent,
                  owner.management_fee_amount
                )}
              </strong>
              .{isOverridden ? " This period is currently overridden." : ""}
            </>
          ) : (
            "Set the fee charged on this statement."
          )}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div>
            <label htmlFor="fee-type" className="text-sm font-medium text-foreground">
              Fee for this period
            </label>
            <p className="text-[11px] text-foreground-muted mt-0.5 mb-1">
              Choose &quot;No fee&quot; to waive the charge for this month only.
            </p>
            <select id="fee-type" {...register("type")} className={inputCls}>
              <option value="none">No fee this period</option>
              <option value="percent">Percentage of rent due</option>
              <option value="flat">Flat amount</option>
            </select>
            {errors.type && <p className="text-xs text-red-600 mt-1">{errors.type.message}</p>}
          </div>

          {feeType === "percent" && (
            <div>
              <label htmlFor="fee-percent" className="text-sm font-medium text-foreground">
                Percentage (%)
              </label>
              <p className="text-[11px] text-foreground-muted mt-0.5 mb-1">
                e.g. 10 for 10% of the rent due this period. Max 100.
              </p>
              <input
                id="fee-percent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                {...register("percent", { setValueAs: (v) => (v === "" ? null : Number(v)) })}
                className={inputCls}
              />
              {errors.percent && (
                <p className="text-xs text-red-600 mt-1">{errors.percent.message}</p>
              )}
            </div>
          )}

          {feeType === "flat" && (
            <div>
              <label htmlFor="fee-amount" className="text-sm font-medium text-foreground">
                Amount (£)
              </label>
              <p className="text-[11px] text-foreground-muted mt-0.5 mb-1">
                Charged in full for this period, e.g. 150.00.
              </p>
              <input
                id="fee-amount"
                type="number"
                step="0.01"
                min="0"
                {...register("amount", { setValueAs: (v) => (v === "" ? null : Number(v)) })}
                className={inputCls}
              />
              {errors.amount && <p className="text-xs text-red-600 mt-1">{errors.amount.message}</p>}
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-foreground-secondary">
            <input type="checkbox" {...register("apply_to_default")} className="mt-0.5 rounded border-border" />
            <span>
              Also make this the landlord&apos;s standing fee
              <span className="block text-[11px] text-foreground-muted">
                Applies to future statements too. Statements already sent are never changed.
              </span>
            </span>
          </label>

          <div className="flex justify-between gap-2 pt-1">
            {isOverridden ? (
              <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={onClear}>
                Use standing fee
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="secondary" size="sm" loading={isPending}>
                Save fee
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

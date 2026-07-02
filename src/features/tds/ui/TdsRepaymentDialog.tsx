"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Banknote } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { raiseTdsRepaymentSchema, type RaiseTdsRepaymentInput } from "../domain/deposit-types";
import { raiseTdsRepayment } from "../actions/repayment";

type FormValues = RaiseTdsRepaymentInput;

const selectCls =
  "flex h-10 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand focus:ring-2 focus:ring-border-ring/20";

function Field({
  label,
  hint,
  htmlFor,
  error,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-foreground">
        {label}
      </label>
      {hint ? <p className="text-[11px] text-foreground-muted">{hint}</p> : null}
      {children}
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function TdsRepaymentDialog({ depositId, dan }: { depositId: string; dan: string }) {
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(raiseTdsRepaymentSchema),
    defaultValues: {
      depositId,
      tenancyEndDate: "",
      tenantRepayment: 0,
      tenantRepaymentType: "split",
      agent: {
        total: 0,
        cleaning: 0,
        rentArrears: 0,
        damage: 0,
        redecoration: 0,
        gardening: 0,
        other: 0,
        otherText: "",
      },
    },
  });

  const agent = watch("agent");
  const subSum =
    num(agent?.cleaning) +
    num(agent?.rentArrears) +
    num(agent?.damage) +
    num(agent?.redecoration) +
    num(agent?.gardening) +
    num(agent?.other);

  // The agent total is always the sum of the sub-splits (satisfies the TDS rule).
  useEffect(() => {
    setValue("agent.total", subSum as unknown as number, { shouldValidate: false });
  }, [subSum, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await raiseTdsRepayment(values);
      if (res.ok) {
        toast.success("Repayment request sent to TDS.");
        setOpen(false);
        reset();
      } else {
        toast.error(res.error ?? "TDS rejected the repayment request.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to raise the repayment request.");
    }
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Banknote className="h-3.5 w-3.5" />
        Request repayment
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Raise a repayment request</DialogTitle>
            <DialogDescription>
              Propose how the deposit for DAN {dan} is repaid. The agent breakdown must add up to the
              agent total (calculated for you below).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              <Field
                label="Tenancy end date"
                hint="The date the tenancy ended"
                htmlFor="tds-rp-end"
                error={errors.tenancyEndDate?.message}
              >
                <Input id="tds-rp-end" type="date" {...register("tenancyEndDate")} />
              </Field>
              <Field
                label="Tenant repayment (£)"
                hint="Total returned to the tenant(s)"
                htmlFor="tds-rp-tenant"
                error={errors.tenantRepayment?.message}
              >
                <Input id="tds-rp-tenant" type="number" step="0.01" {...register("tenantRepayment")} />
              </Field>
              <Field
                label="Tenant repayment type"
                hint="Split equally, or pay the lead tenant"
                htmlFor="tds-rp-type"
                error={errors.tenantRepaymentType?.message}
              >
                <select id="tds-rp-type" className={selectCls} {...register("tenantRepaymentType")}>
                  <option value="split">Split between tenants</option>
                  <option value="lead">Pay lead tenant</option>
                </select>
              </Field>
            </div>

            <div className="space-y-2.5 rounded-lg border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                Agent repayment breakdown
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Cleaning (£)" htmlFor="tds-rp-cleaning" error={errors.agent?.cleaning?.message}>
                  <Input id="tds-rp-cleaning" type="number" step="0.01" {...register("agent.cleaning")} />
                </Field>
                <Field label="Rent arrears (£)" htmlFor="tds-rp-arrears" error={errors.agent?.rentArrears?.message}>
                  <Input id="tds-rp-arrears" type="number" step="0.01" {...register("agent.rentArrears")} />
                </Field>
                <Field label="Damage (£)" htmlFor="tds-rp-damage" error={errors.agent?.damage?.message}>
                  <Input id="tds-rp-damage" type="number" step="0.01" {...register("agent.damage")} />
                </Field>
                <Field label="Redecoration (£)" htmlFor="tds-rp-redec" error={errors.agent?.redecoration?.message}>
                  <Input id="tds-rp-redec" type="number" step="0.01" {...register("agent.redecoration")} />
                </Field>
                <Field label="Gardening (£)" htmlFor="tds-rp-garden" error={errors.agent?.gardening?.message}>
                  <Input id="tds-rp-garden" type="number" step="0.01" {...register("agent.gardening")} />
                </Field>
                <Field label="Other (£)" htmlFor="tds-rp-other" error={errors.agent?.other?.message}>
                  <Input id="tds-rp-other" type="number" step="0.01" {...register("agent.other")} />
                </Field>
              </div>
              {num(agent?.other) > 0 ? (
                <Field
                  label="Other — description"
                  hint="Required when 'Other' is greater than 0"
                  htmlFor="tds-rp-othertext"
                  error={errors.agent?.otherText?.message}
                >
                  <Input id="tds-rp-othertext" {...register("agent.otherText")} />
                </Field>
              ) : null}
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                <span className="text-foreground-muted">Agent total</span>
                <span className="font-semibold text-foreground">£{subSum.toFixed(2)}</span>
              </div>
              {errors.agent?.total?.message ? (
                <p className="text-xs text-red-500">{errors.agent.total.message}</p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="secondary" loading={isSubmitting}>
                <Banknote className="h-4 w-4" />
                Send request
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

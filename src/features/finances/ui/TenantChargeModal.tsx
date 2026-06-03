"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  tenantChargeSchema,
  TENANT_CHARGE_TYPE_LABELS,
  type TenantRecurringCharge,
  type TenantChargeFormValues,
} from "../domain/tenant-charges";
import type { ContractOption } from "../data/tenant-charges";
import { createTenantCharge, updateTenantCharge } from "../actions/tenant-charges";

type Props = {
  open: boolean;
  editing: TenantRecurringCharge | null;
  contracts: ContractOption[];
  defaultContractId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function TenantChargeModal({
  open,
  editing,
  contracts,
  defaultContractId,
  onClose,
  onSuccess,
}: Props) {
  const isEdit = !!editing;
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TenantChargeFormValues>({
    resolver: zodResolver(tenantChargeSchema),
    defaultValues: defaults(editing, defaultContractId, contracts[0]?.contract_id),
  });

  useEffect(() => {
    reset(defaults(editing, defaultContractId, contracts[0]?.contract_id));
  }, [editing, defaultContractId, contracts, reset]);

  async function onSubmit(values: TenantChargeFormValues) {
    setLoading(true);
    try {
      const result = isEdit
        ? await updateTenantCharge(editing!.id, values)
        : await createTenantCharge(values);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(isEdit ? "Charge updated" : "Charge added");
        onSuccess();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-surface-card shadow-xl border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? "Edit tenant charge" : "Add tenant charge"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-inset text-foreground-muted"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Contract <span className="text-red-500">*</span>
            </label>
            {isEdit ? (
              <input
                type="hidden"
                {...register("contract_id")}
              />
            ) : null}
            {isEdit ? (
              <div className="rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground-secondary">
                Contract is locked once a charge is created.
              </div>
            ) : (
              <select
                {...register("contract_id")}
                className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
              >
                {contracts.length === 0 ? (
                  <option value="">No active contracts</option>
                ) : (
                  contracts.map((c) => (
                    <option key={c.contract_id} value={c.contract_id}>
                      {c.tenant_name} · {c.property_name} · {c.unit_label}
                    </option>
                  ))
                )}
              </select>
            )}
            {errors.contract_id && (
              <p className="text-xs text-red-600 mt-1">{errors.contract_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Charge type <span className="text-red-500">*</span>
            </label>
            <select
              {...register("charge_type")}
              className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {Object.entries(TENANT_CHARGE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              {...register("label")}
              type="text"
              placeholder="e.g. Electricity"
              className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
            />
            {errors.label && (
              <p className="text-xs text-red-600 mt-1">{errors.label.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Amount (£) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-muted">£</span>
                <input
                  {...register("amount_pounds")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="w-full rounded-lg border border-border bg-surface-inset pl-7 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              {errors.amount_pounds && (
                <p className="text-xs text-red-600 mt-1">{errors.amount_pounds.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Recurrence day (1–31) <span className="text-red-500">*</span>
              </label>
              <input
                {...register("recurrence_day")}
                type="number"
                min="1"
                max="31"
                placeholder="1"
                className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
              />
              {errors.recurrence_day && (
                <p className="text-xs text-red-600 mt-1">{errors.recurrence_day.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Start date <span className="text-red-500">*</span>
              </label>
              <input
                {...register("start_date")}
                type="date"
                className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
              />
              {errors.start_date && (
                <p className="text-xs text-red-600 mt-1">{errors.start_date.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">End date</label>
              <input
                {...register("end_date")}
                type="date"
                className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
              />
              {errors.end_date && (
                <p className="text-xs text-red-600 mt-1">{errors.end_date.message}</p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              {...register("is_active")}
              type="checkbox"
              className="rounded border-border text-brand focus:ring-brand"
            />
            <span className="text-foreground">Active</span>
          </label>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Notes</label>
            <textarea
              {...register("notes")}
              rows={2}
              placeholder="Optional"
              className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" size="md" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              size="md"
              disabled={loading || (!isEdit && contracts.length === 0)}
              className="flex-1"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? "Save changes" : "Add charge"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function defaults(
  c: TenantRecurringCharge | null,
  defaultContractId: string | null | undefined,
  firstContractId: string | undefined
): TenantChargeFormValues {
  return {
    contract_id: c?.contract_id ?? defaultContractId ?? firstContractId ?? "",
    charge_type: (c?.charge_type ?? "utilities") as TenantChargeFormValues["charge_type"],
    label: c?.label ?? "",
    amount_pounds: c ? c.amount / 100 : ("" as unknown as number),
    recurrence_day: c?.recurrence_day ?? 1,
    start_date: c?.start_date ?? new Date().toISOString().slice(0, 10),
    end_date: c?.end_date ?? "",
    is_active: c?.is_active ?? true,
    notes: c?.notes ?? "",
  };
}

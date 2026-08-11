"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { formatDate, formatGBP } from "@/lib/utils/formatters";
import { updateOwner } from "../actions/owners";
import { ownerUpdateSchema, type OwnerUpdateValues } from "../domain/schemas";
import {
  formatFeeConfig,
  PAYMENT_SCHEDULE_LABELS,
  type OwnerLandlord,
} from "../domain/types";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const areaCls =
  "w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

/** Label above, hint under the label, inline error below — per the UI rules. */
function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <p className="text-[11px] text-foreground-muted mt-0.5 mb-1">{hint}</p>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

/** Read-only label/value pair used by the view mode. */
function ReadRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wide text-foreground-muted">{label}</p>
      <p className="text-sm text-foreground whitespace-pre-wrap mt-0.5">{value || "—"}</p>
    </div>
  );
}

function Section({
  title,
  children,
  action,
  hint,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  hint?: string;
}) {
  return (
    <section className="rounded-bento bg-surface-card shadow-bento p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {hint && <p className="text-xs text-foreground-muted mt-0.5">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function OwnerDetailsForm({ owner }: { owner: OwnerLandlord }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // The Overview tab is a record, not a form — it stays read-only until the
  // user explicitly chooses to edit, so details can't be changed by accident.
  const [editing, setEditing] = useState(false);

  const defaults: OwnerUpdateValues = {
    id: owner.id,
    name: owner.name,
    phone: owner.phone ?? "",
    email: owner.email ?? "",
    address: owner.address ?? "",
    notes: owner.notes ?? "",
    contract_start_date: owner.contract_start_date ?? "",
    contract_expiry_date: owner.contract_expiry_date ?? "",
    next_payment_due: owner.next_payment_due ?? "",
    payment_schedule: owner.payment_schedule ?? "",
    monthly_rent_owed: owner.monthly_rent_owed ?? null,
    management_fee_type: owner.management_fee_type,
    management_fee_percent: owner.management_fee_percent ?? null,
    management_fee_amount: owner.management_fee_amount ?? null,
    alert_60_days: owner.alert_60_days,
    alert_30_days: owner.alert_30_days,
  };

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<OwnerUpdateValues>({
    resolver: zodResolver(ownerUpdateSchema),
    defaultValues: defaults,
  });

  const feeType = watch("management_fee_type");

  const onSubmit = (values: OwnerUpdateValues) => {
    startTransition(async () => {
      const result = await updateOwner(values);
      if (!result.ok) {
        toast.error("Could not save", { description: result.error });
        return;
      }
      toast.success("Landlord updated.");
      setEditing(false);
      router.refresh();
    });
  };

  const onCancel = () => {
    if (isDirty && !window.confirm("Discard your unsaved changes?")) return;
    reset(defaults);
    setEditing(false);
  };

  /* ── View mode ───────────────────────────────────────── */
  if (!editing) {
    const alerts = [
      owner.alert_60_days ? "60 days" : null,
      owner.alert_30_days ? "30 days" : null,
    ].filter(Boolean);

    return (
      <div className="space-y-6">
        <Section
          title="Landlord details"
          action={
            <Tooltip content="Details are locked so they can't be changed by accident. Statements already sent are never affected by edits here.">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4 mr-1.5" />
                Edit
              </Button>
            </Tooltip>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReadRow label="Name" value={owner.name} />
            <ReadRow label="Email" value={owner.email} />
            <ReadRow label="Phone" value={owner.phone} />
            <ReadRow label="Address" value={owner.address} />
            <ReadRow label="Notes" value={owner.notes} className="md:col-span-2" />
          </div>
        </Section>

        <Section
          title="Management fee"
          hint="The standing deal. An individual statement can still be adjusted for one period."
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ReadRow
              label="Fee"
              value={formatFeeConfig(
                owner.management_fee_type,
                owner.management_fee_percent,
                owner.management_fee_amount
              )}
            />
          </div>
        </Section>

        <Section title="Contract &amp; payments">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ReadRow
              label="Contract start"
              value={owner.contract_start_date ? formatDate(owner.contract_start_date) : null}
            />
            <ReadRow
              label="Contract expiry"
              value={owner.contract_expiry_date ? formatDate(owner.contract_expiry_date) : null}
            />
            <ReadRow
              label="Next payment due"
              value={owner.next_payment_due ? formatDate(owner.next_payment_due) : null}
            />
            <ReadRow
              label="Payment schedule"
              value={owner.payment_schedule ? PAYMENT_SCHEDULE_LABELS[owner.payment_schedule] : null}
            />
            <ReadRow
              label="Monthly rent owed"
              value={
                owner.monthly_rent_owed != null ? formatGBP(Number(owner.monthly_rent_owed)) : null
              }
            />
            <ReadRow
              label="Renewal alerts"
              value={alerts.length > 0 ? `${alerts.join(" and ")} before expiry` : "Off"}
            />
          </div>
        </Section>
      </div>
    );
  }

  /* ── Edit mode ───────────────────────────────────────── */
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <input type="hidden" {...register("id")} />

      <Section title="Landlord details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name" hint="Person or company you pay rent to. Max 200 characters." htmlFor="name" error={errors.name?.message}>
            <input id="name" {...register("name")} className={inputCls} autoFocus />
          </Field>

          <Field label="Email" hint="Where statements are emailed. Leave blank if they don't take email." htmlFor="email" error={errors.email?.message}>
            <input id="email" type="email" {...register("email")} className={inputCls} placeholder="name@example.com" />
          </Field>

          <Field label="Phone" hint="Include the country code, e.g. +44 7700 900123." htmlFor="phone" error={errors.phone?.message}>
            <input id="phone" {...register("phone")} className={inputCls} placeholder="+44 7700 900123" />
          </Field>

          <Field label="Address" hint="Postal address the statement is addressed to. Max 500 characters." htmlFor="address" error={errors.address?.message}>
            <textarea id="address" rows={3} {...register("address")} className={areaCls} />
          </Field>

          <Field label="Notes" hint="Internal only — never shown on a statement. Max 2000 characters." htmlFor="notes" error={errors.notes?.message} className="md:col-span-2">
            <textarea id="notes" rows={3} {...register("notes")} className={areaCls} />
          </Field>
        </div>
      </Section>

      <Section
        title="Management fee"
        hint="Deducted from the rent owed on their properties, on every future statement. Statements already sent are never changed."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Fee type" hint="How you charge this landlord to manage their property." htmlFor="management_fee_type" error={errors.management_fee_type?.message}>
            <select id="management_fee_type" {...register("management_fee_type")} className={inputCls}>
              <option value="none">None — landlord pays nothing</option>
              <option value="percent">Percentage of rent due</option>
              <option value="flat">Flat monthly amount</option>
            </select>
          </Field>

          {feeType === "percent" && (
            <Field label="Fee percentage (%)" hint="e.g. 10 for 10% of the rent due on their properties. Max 100." htmlFor="management_fee_percent" error={errors.management_fee_percent?.message}>
              <input
                id="management_fee_percent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                {...register("management_fee_percent", { setValueAs: (v) => (v === "" ? null : Number(v)) })}
                className={inputCls}
                placeholder="10"
              />
            </Field>
          )}

          {feeType === "flat" && (
            <Field label="Flat monthly fee (£)" hint="Charged in full each period regardless of the rent due." htmlFor="management_fee_amount" error={errors.management_fee_amount?.message}>
              <input
                id="management_fee_amount"
                type="number"
                step="0.01"
                min="0"
                {...register("management_fee_amount", { setValueAs: (v) => (v === "" ? null : Number(v)) })}
                className={inputCls}
                placeholder="75.00"
              />
            </Field>
          )}
        </div>
      </Section>

      <Section title="Contract &amp; payments">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Contract start" hint="Date your agreement with this landlord began." htmlFor="contract_start_date" error={errors.contract_start_date?.message}>
            <input id="contract_start_date" type="date" {...register("contract_start_date")} className={inputCls} />
          </Field>

          <Field label="Contract expiry" hint="Drives the renewal alerts below. Must be after the start date." htmlFor="contract_expiry_date" error={errors.contract_expiry_date?.message}>
            <input id="contract_expiry_date" type="date" {...register("contract_expiry_date")} className={inputCls} />
          </Field>

          <Field label="Next payment due" hint="When you next remit to this landlord." htmlFor="next_payment_due" error={errors.next_payment_due?.message}>
            <input id="next_payment_due" type="date" {...register("next_payment_due")} className={inputCls} />
          </Field>

          <Field label="Payment schedule" hint="How often you pay them out." htmlFor="payment_schedule" error={errors.payment_schedule?.message}>
            <select id="payment_schedule" {...register("payment_schedule")} className={inputCls}>
              <option value="">Not set</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="biannual">Every 6 months</option>
              <option value="annual">Annually</option>
            </select>
          </Field>

          <Field label="Monthly rent owed (£)" hint="Rent-to-rent only — the fixed amount you owe them each month." htmlFor="monthly_rent_owed" error={errors.monthly_rent_owed?.message}>
            <input
              id="monthly_rent_owed"
              type="number"
              step="0.01"
              min="0"
              {...register("monthly_rent_owed", { setValueAs: (v) => (v === "" ? null : Number(v)) })}
              className={inputCls}
              placeholder="0.00"
            />
          </Field>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-foreground">Renewal alerts</p>
          <p className="text-[11px] text-foreground-muted">
            Reminders ahead of the contract expiry date above. No effect if no expiry is set.
          </p>
          <label className="flex items-center gap-2 text-sm text-foreground-secondary">
            <input type="checkbox" {...register("alert_60_days")} className="rounded border-border" />
            Alert 60 days before expiry
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground-secondary">
            <input type="checkbox" {...register("alert_30_days")} className="rounded border-border" />
            Alert 30 days before expiry
          </label>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" size="md" loading={isPending} disabled={!isDirty}>
          Save changes
        </Button>
        <Button type="button" variant="ghost" size="md" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
        {isDirty && <span className="text-xs text-foreground-muted">Unsaved changes</span>}
      </div>
    </form>
  );
}

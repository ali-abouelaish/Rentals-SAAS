"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { landlordSchema, type LandlordFormValues } from "../domain/schemas";

const inputCls =
  "h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-xs text-foreground-muted">{hint}</p>
    </div>
  );
}

interface LandlordFormProps {
  defaultValues: LandlordFormValues;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  onSubmit: (values: LandlordFormValues) => void;
}

export function LandlordForm({
  defaultValues,
  submitLabel,
  pendingLabel,
  isPending,
  onSubmit,
}: LandlordFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LandlordFormValues>({
    resolver: zodResolver(landlordSchema),
    defaultValues,
  });

  return (
    // noValidate: Zod owns validation — native browser tooltips (type=email
    // etc.) would fire first and mask the inline errors.
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 md:grid-cols-2">
      <Field label="Name *" hint="Landlord's full name or company name." error={errors.name?.message}>
        <input {...register("name")} className={inputCls} />
      </Field>
      <Field label="Contact" hint="Phone number or contact person." error={errors.contact?.message}>
        <input {...register("contact")} className={inputCls} />
      </Field>
      <Field
        label="Billing address"
        hint="Address used on invoices."
        error={errors.billing_address?.message}
      >
        <input {...register("billing_address")} className={inputCls} />
      </Field>
      <Field label="Email" hint="Used for invoices and notifications." error={errors.email?.message}>
        <input type="email" {...register("email")} className={inputCls} />
      </Field>
      <Field
        label="Spareroom profile URL"
        hint="Full link including https://"
        error={errors.spareroom_profile_url?.message}
      >
        <input {...register("spareroom_profile_url")} className={inputCls} />
      </Field>
      <Field
        label="Pays commission"
        hint="Whether this landlord pays your agency commission."
        error={errors.pays_commission?.message}
      >
        <select {...register("pays_commission")} className={inputCls}>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </Field>
      <Field
        label="Commission amount (£)"
        hint="Commission in pounds — 0 if none."
        error={errors.commission_amount_gbp?.message}
      >
        <input type="number" step="0.01" min={0} {...register("commission_amount_gbp")} className={inputCls} />
      </Field>
      <Field
        label="Commission term"
        hint={'E.g. "1 week" or "10% of first month".'}
        error={errors.commission_term_text?.message}
      >
        <input {...register("commission_term_text")} className={inputCls} />
      </Field>
      <Field
        label="We do viewing"
        hint="Whether your agency handles viewings for this landlord."
        error={errors.we_do_viewing?.message}
      >
        <select {...register("we_do_viewing")} className={inputCls}>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field
          label="Profile notes"
          hint="Internal notes — not shown to the landlord."
          error={errors.profile_notes?.message}
        >
          <textarea rows={3} {...register("profile_notes")} className={`${inputCls} h-auto py-2`} />
        </Field>
      </div>
      <div className="md:col-span-2">
        <Button type="submit" variant="secondary" loading={isPending}>
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}

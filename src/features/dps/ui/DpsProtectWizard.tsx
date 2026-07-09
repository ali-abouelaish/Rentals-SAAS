"use client";

import { useState } from "react";
import { useForm, useFieldArray, type UseFormRegister, type FieldError } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ShieldCheck, Plus, Trash2, Home, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  registerDpsDepositSchema,
  DPS_RENT_FREQUENCIES,
  type RegisterDpsDepositInput,
} from "../domain/deposit-types";
import { registerDpsDeposit, type RegisterDpsDepositResult } from "../actions/registerDeposit";

type FormValues = RegisterDpsDepositInput;

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

type TenantErrors =
  | {
      title?: FieldError;
      firstName?: FieldError;
      lastName?: FieldError;
      email?: FieldError;
      mobile?: FieldError;
    }
  | undefined;

function TenantFields({
  index,
  register,
  errors,
}: {
  index: number;
  register: UseFormRegister<FormValues>;
  errors: TenantErrors;
}) {
  const id = `dps-tenant-${index}`;
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Field label="Title" hint="e.g. Mr, Mrs, Ms" htmlFor={`${id}-title`} error={errors?.title?.message}>
        <Input id={`${id}-title`} {...register(`tenants.${index}.title`)} />
      </Field>
      <Field label="First name" hint="Min 2 characters" htmlFor={`${id}-first`} error={errors?.firstName?.message}>
        <Input id={`${id}-first`} {...register(`tenants.${index}.firstName`)} />
      </Field>
      <Field label="Last name" hint="Min 2 characters" htmlFor={`${id}-last`} error={errors?.lastName?.message}>
        <Input id={`${id}-last`} {...register(`tenants.${index}.lastName`)} />
      </Field>
      <Field
        label="Email"
        hint="Email or UK mobile required"
        htmlFor={`${id}-email`}
        error={errors?.email?.message}
      >
        <Input id={`${id}-email`} type="email" {...register(`tenants.${index}.email`)} />
      </Field>
      <Field
        label="UK mobile"
        hint="Starts 07, 11 digits"
        htmlFor={`${id}-mobile`}
        error={errors?.mobile?.message}
      >
        <Input id={`${id}-mobile`} inputMode="tel" {...register(`tenants.${index}.mobile`)} />
      </Field>
    </div>
  );
}

function splitName(full: string | undefined | null): { firstName: string; lastName: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Whole months between two ISO dates, clamped to the DPS 1–108 range. */
function monthsBetween(startIso?: string | null, endIso?: string | null): number {
  if (!startIso || !endIso) return 12;
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 12;
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (e.getDate() < s.getDate()) months -= 1;
  return Math.min(108, Math.max(1, months));
}

/** Default DatePaid: the day before the tenancy starts, but never in the future. */
function defaultDatePaid(startIso?: string | null): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!startIso) return today;
  const d = new Date(startIso);
  if (isNaN(d.getTime())) return today;
  d.setDate(d.getDate() - 1);
  const dayBeforeStart = d.toISOString().slice(0, 10);
  return dayBeforeStart < today ? dayBeforeStart : today;
}

export function DpsProtectWizard({
  contractId,
  depositPounds,
  rentPcm,
  defaultTenant,
  defaultProperty,
  startDate,
  endDate,
  triggerLabel = "Register with DPS",
  resume = false,
}: {
  contractId: string;
  depositPounds: number;
  rentPcm?: number | null;
  defaultTenant?: { fullName: string; email: string; phone: string } | null;
  defaultProperty?: {
    street?: string | null;
    saon?: string | null;
    town?: string | null;
    postcode?: string | null;
  } | null;
  startDate?: string | null;
  endDate?: string | null;
  triggerLabel?: string;
  resume?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<RegisterDpsDepositResult | null>(null);
  const [hasRelevantPerson, setHasRelevantPerson] = useState(false);

  const leadName = splitName(defaultTenant?.fullName);
  const isoStart = (startDate ?? "").slice(0, 10);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(registerDpsDepositSchema),
    defaultValues: {
      contractId,
      property: {
        addressLine1: defaultProperty?.street ?? "",
        addressLine2: defaultProperty?.saon ?? "",
        addressLine3: "",
        town: defaultProperty?.town ?? "",
        county: "",
        postcode: defaultProperty?.postcode ?? "",
        propertyType: undefined,
        furnishingType: undefined,
        numberOfBedrooms: undefined,
      },
      tenancy: {
        startDate: isoStart,
        tenancyLengthMonths: monthsBetween(isoStart, (endDate ?? "").slice(0, 10)),
        rentAmount: rentPcm ?? undefined,
        rentFrequency: 1,
        depositAmount: depositPounds,
        datePaid: defaultDatePaid(isoStart),
        tenancyReference: "",
      },
      tenants: [
        {
          title: "",
          firstName: leadName.firstName,
          lastName: leadName.lastName,
          email: defaultTenant?.email ?? "",
          mobile: "",
          tenantReference: "",
        },
      ],
      relevantPerson: null,
    },
  });

  const tenants = useFieldArray({ control, name: "tenants" });

  const toggleRelevantPerson = (checked: boolean) => {
    setHasRelevantPerson(checked);
    setValue(
      "relevantPerson",
      checked
        ? { firstName: "", lastName: "", email: "", companyName: "", mobile: "" }
        : null,
      { shouldValidate: false }
    );
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await registerDpsDeposit(values);
      setResult(res);
      if (res.ok) {
        toast.success(
          res.alreadySubmitted
            ? "This tenancy is already registered with DPS."
            : "Tenancy registered with DPS — awaiting deposit payment."
        );
      } else {
        toast.error(res.error ?? "DPS rejected the registration.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to register the deposit.");
    }
  });

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <ShieldCheck className="h-3.5 w-3.5" />
        {resume ? "Resume DPS registration" : triggerLabel}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setResult(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register deposit with DPS</DialogTitle>
            <DialogDescription>
              Deposit amount £{depositPounds.toLocaleString()}. The tenancy is created on the
              agency&apos;s DPS account as “Awaiting deposit payment”; the deposit is then paid via
              the DPS portal or by bank transfer (mark it for bank transfer from the Deposits page).
            </DialogDescription>
          </DialogHeader>

          {result?.ok ? (
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                DPS deposit ID:{" "}
                <span className="font-mono font-semibold">{result.dpsDepositId}</span>
              </p>
              <p className="text-xs text-foreground-secondary">
                {result.alreadySubmitted
                  ? "This tenancy had already been registered; nothing was resent."
                  : "The deposit is awaiting payment. Either pay it from the agency's DPS portal account, or mark it for bank transfer on the Deposits page and pay by bank transfer using the reference DPS returns."}
              </p>
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              {resume ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                  An earlier attempt did not complete. Re-submitting resends the registration — a
                  tenancy that already has a DPS deposit ID will not be duplicated.
                </p>
              ) : null}

              {/* Property */}
              <section className="space-y-3">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  <Home className="h-3.5 w-3.5" /> Tenancy address
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field
                    label="Address line 1"
                    hint="Max 50 characters"
                    htmlFor="dps-addr1"
                    error={errors.property?.addressLine1?.message}
                  >
                    <Input id="dps-addr1" {...register("property.addressLine1")} />
                  </Field>
                  <Field
                    label="Address line 2"
                    hint="Optional — e.g. Flat 6, Room 2"
                    htmlFor="dps-addr2"
                    error={errors.property?.addressLine2?.message}
                  >
                    <Input id="dps-addr2" {...register("property.addressLine2")} />
                  </Field>
                  <Field
                    label="Town"
                    hint="Max 50 characters"
                    htmlFor="dps-town"
                    error={errors.property?.town?.message}
                  >
                    <Input id="dps-town" {...register("property.town")} />
                  </Field>
                  <Field
                    label="Postcode"
                    hint="England or Wales only — DPS validates this"
                    htmlFor="dps-postcode"
                    error={errors.property?.postcode?.message}
                  >
                    <Input id="dps-postcode" {...register("property.postcode")} />
                  </Field>
                </div>
              </section>

              {/* Tenancy */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  Tenancy & deposit
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field
                    label="Tenancy start date"
                    hint="Agreement start"
                    htmlFor="dps-start"
                    error={errors.tenancy?.startDate?.message}
                  >
                    <Input id="dps-start" type="date" {...register("tenancy.startDate")} />
                  </Field>
                  <Field
                    label="Tenancy length (months)"
                    hint="Whole months, 1–108"
                    htmlFor="dps-length"
                    error={errors.tenancy?.tenancyLengthMonths?.message}
                  >
                    <Input
                      id="dps-length"
                      type="number"
                      min={1}
                      max={108}
                      {...register("tenancy.tenancyLengthMonths")}
                    />
                  </Field>
                  <Field
                    label="Rent amount (£)"
                    hint="Per rent period, max £99,999.99"
                    htmlFor="dps-rent"
                    error={errors.tenancy?.rentAmount?.message}
                  >
                    <Input id="dps-rent" type="number" step="0.01" {...register("tenancy.rentAmount")} />
                  </Field>
                  <Field
                    label="Rent frequency"
                    hint="How often rent is due"
                    htmlFor="dps-freq"
                    error={errors.tenancy?.rentFrequency?.message}
                  >
                    <select id="dps-freq" className={selectCls} {...register("tenancy.rentFrequency")}>
                      {DPS_RENT_FREQUENCIES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Deposit amount (£)"
                    hint="As per the tenancy agreement"
                    htmlFor="dps-deposit"
                    error={errors.tenancy?.depositAmount?.message}
                  >
                    <Input
                      id="dps-deposit"
                      type="number"
                      step="0.01"
                      {...register("tenancy.depositAmount")}
                    />
                  </Field>
                  <Field
                    label="Date deposit paid"
                    hint="When the tenant paid it — must be before the start date and not in the future"
                    htmlFor="dps-paid"
                    error={errors.tenancy?.datePaid?.message}
                  >
                    <Input id="dps-paid" type="date" {...register("tenancy.datePaid")} />
                  </Field>
                </div>
              </section>

              {/* Tenants */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                    <Users className="h-3.5 w-3.5" /> Tenants ({tenants.fields.length}/10)
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={tenants.fields.length >= 10}
                    onClick={() =>
                      tenants.append({
                        title: "",
                        firstName: "",
                        lastName: "",
                        email: "",
                        mobile: "",
                        tenantReference: "",
                      })
                    }
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                {errors.tenants?.message ? (
                  <p className="text-xs text-red-500">{errors.tenants.message}</p>
                ) : null}
                {tenants.fields.map((f, i) => (
                  <div key={f.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground-muted">
                        {i === 0 ? "Lead tenant" : `Tenant ${i + 1}`}
                      </span>
                      {i > 0 ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="xs"
                          onClick={() => tenants.remove(i)}
                          aria-label="Remove tenant"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      ) : null}
                    </div>
                    <TenantFields index={i} register={register} errors={errors.tenants?.[i]} />
                  </div>
                ))}
              </section>

              {/* Relevant person */}
              <section className="space-y-3">
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={hasRelevantPerson}
                    onChange={(e) => toggleRelevantPerson(e.target.checked)}
                  />
                  Someone other than the tenants paid part or all of the deposit (relevant person)
                </label>
                {hasRelevantPerson ? (
                  <div className="rounded-lg border border-border p-3">
                    <p className="mb-2 text-[11px] text-foreground-muted">
                      They receive a copy of the protection certificate for information only, and
                      have no rights over the deposit. Their email must differ from every tenant&apos;s.
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Field
                        label="First name"
                        htmlFor="dps-rp-first"
                        error={errors.relevantPerson?.firstName?.message}
                      >
                        <Input id="dps-rp-first" {...register("relevantPerson.firstName")} />
                      </Field>
                      <Field
                        label="Last name"
                        hint="Min 2 characters"
                        htmlFor="dps-rp-last"
                        error={errors.relevantPerson?.lastName?.message}
                      >
                        <Input id="dps-rp-last" {...register("relevantPerson.lastName")} />
                      </Field>
                      <Field
                        label="Email"
                        hint="Must differ from tenant and agency emails"
                        htmlFor="dps-rp-email"
                        error={errors.relevantPerson?.email?.message}
                      >
                        <Input id="dps-rp-email" type="email" {...register("relevantPerson.email")} />
                      </Field>
                      <Field
                        label="Company (optional)"
                        hint="If they paid on behalf of an organisation"
                        htmlFor="dps-rp-company"
                        error={errors.relevantPerson?.companyName?.message}
                      >
                        <Input id="dps-rp-company" {...register("relevantPerson.companyName")} />
                      </Field>
                    </div>
                  </div>
                ) : null}
              </section>

              {result && !result.ok ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 space-y-1">
                  <p>{result.error}</p>
                  {result.fieldErrors?.map((fe, i) => (
                    <p key={i} className="font-mono text-[11px]">
                      {fe.field}: {fe.message}
                    </p>
                  ))}
                </div>
              ) : null}

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="secondary" loading={isSubmitting}>
                  <ShieldCheck className="h-4 w-4" />
                  Submit to DPS
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

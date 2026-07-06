"use client";

import { useState } from "react";
import { useForm, useFieldArray, type UseFormRegister, type FieldError } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ShieldCheck, Plus, Trash2, Home, User, Building2 } from "lucide-react";
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
  registerTdsDepositSchema,
  FURNISHED_STATUSES,
  type RegisterTdsDepositInput,
} from "../domain/deposit-types";
import { registerTdsDeposit, type RegisterTdsDepositResult } from "../actions/registerDeposit";

type FormValues = RegisterTdsDepositInput;

const selectCls =
  "flex h-10 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand focus:ring-2 focus:ring-border-ring/20";

// Temporarily hide the schema-optional fields to keep the form lean.
// Flip to true to restore SAON / locality / furnished status / monthly rent /
// landlord email+mobile / landlord SAON+locality+country.
const SHOW_OPTIONAL_FIELDS = false;

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

type PersonErrors =
  | {
      title?: FieldError;
      firstName?: FieldError;
      surname?: FieldError;
      email?: FieldError;
      mobile?: FieldError;
    }
  | undefined;

/** Title / name / contact fields shared by lead tenant, joint tenants and guarantors. */
function PersonFields({
  prefix,
  idPrefix,
  register,
  errors,
}: {
  prefix: string;
  idPrefix: string;
  register: UseFormRegister<FormValues>;
  errors: PersonErrors;
}) {
  // register is typed to FormValues paths; the dynamic prefixes are valid at runtime.
  const reg = (field: string) => register(`${prefix}.${field}` as never);
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Field label="Title" hint="e.g. Mr, Mrs, Ms" htmlFor={`${idPrefix}-title`} error={errors?.title?.message}>
        <Input id={`${idPrefix}-title`} {...reg("title")} />
      </Field>
      <Field label="First name" htmlFor={`${idPrefix}-first`} error={errors?.firstName?.message}>
        <Input id={`${idPrefix}-first`} {...reg("firstName")} />
      </Field>
      <Field label="Surname" htmlFor={`${idPrefix}-surname`} error={errors?.surname?.message}>
        <Input id={`${idPrefix}-surname`} {...reg("surname")} />
      </Field>
      <Field
        label="Email"
        hint="Email or mobile required"
        htmlFor={`${idPrefix}-email`}
        error={errors?.email?.message}
      >
        <Input id={`${idPrefix}-email`} type="email" {...reg("email")} />
      </Field>
      <Field
        label="Mobile"
        hint="Include country code if non-UK"
        htmlFor={`${idPrefix}-mobile`}
        error={errors?.mobile?.message}
      >
        <Input id={`${idPrefix}-mobile`} {...reg("mobile")} />
      </Field>
    </div>
  );
}

function splitName(full: string | undefined | null): { firstName: string; surname: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", surname: "" };
  if (parts.length === 1) return { firstName: parts[0], surname: "" };
  return { firstName: parts[0], surname: parts.slice(1).join(" ") };
}

export function TdsProtectWizard({
  contractId,
  depositPounds,
  defaultTenant,
  defaultProperty,
  defaultLandlord,
  startDate,
  endDate,
  triggerLabel = "Register with TDS",
  resume = false,
}: {
  contractId: string;
  depositPounds: number;
  defaultTenant?: { fullName: string; email: string; phone: string } | null;
  defaultProperty?: {
    street?: string | null;
    saon?: string | null;
    town?: string | null;
    postcode?: string | null;
  } | null;
  defaultLandlord?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  startDate?: string | null;
  endDate?: string | null;
  triggerLabel?: string;
  resume?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<RegisterTdsDepositResult | null>(null);

  const leadName = splitName(defaultTenant?.fullName);
  const landlordName = splitName(defaultLandlord?.name);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(registerTdsDepositSchema),
    defaultValues: {
      contractId,
      property: {
        paon: "",
        saon: defaultProperty?.saon ?? "",
        street: defaultProperty?.street ?? "",
        locality: "",
        town: defaultProperty?.town ?? "",
        administrativeArea: "",
        postcode: defaultProperty?.postcode ?? "",
        furnishedStatus: undefined,
      },
      tenancy: {
        startDate: (startDate ?? "").slice(0, 10),
        endDate: (endDate ?? "").slice(0, 10),
        depositReceivedDate: (startDate ?? "").slice(0, 10),
        depositAmount: depositPounds,
        rentAmount: undefined,
      },
      leadTenant: {
        title: "",
        firstName: leadName.firstName,
        surname: leadName.surname,
        email: defaultTenant?.email ?? "",
        mobile: defaultTenant?.phone ?? "",
      },
      jointTenants: [],
      relatedParties: [],
      landlord: {
        title: "",
        firstName: landlordName.firstName,
        surname: landlordName.surname,
        isBusiness: false,
        businessName: "",
        paon: "",
        saon: "",
        street: "",
        locality: "",
        town: "",
        administrativeArea: "",
        postcode: "",
        country: "United Kingdom",
        email: defaultLandlord?.email ?? "",
        mobile: defaultLandlord?.phone ?? "",
      },
    },
  });

  const joint = useFieldArray({ control, name: "jointTenants" });
  const related = useFieldArray({ control, name: "relatedParties" });
  const isBusiness = watch("landlord.isBusiness");

  const emptyPerson = { title: "", firstName: "", surname: "", email: "", mobile: "" };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await registerTdsDeposit(values);
      setResult(res);
      if (res.ok) {
        toast.success(
          res.alreadySubmitted
            ? "This deposit was already submitted to TDS."
            : "Deposit submitted to TDS — awaiting the DAN."
        );
      } else {
        toast.error(res.error ?? "TDS rejected the registration.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to register the deposit.");
    }
  });

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <ShieldCheck className="h-3.5 w-3.5" />
        {resume ? "Resume TDS registration" : triggerLabel}
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
            <DialogTitle>Register deposit with TDS</DialogTitle>
            <DialogDescription>
              Deposit amount £{depositPounds.toLocaleString()}. The deposit is submitted to the
              Tenancy Deposit Scheme (Custodial) and registered as “Registered (not paid)”; the DAN
              is retrieved automatically once processing completes.
            </DialogDescription>
          </DialogHeader>

          {result?.ok ? (
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                Status: <span className="font-semibold capitalize">{result.status}</span>
              </p>
              <p className="text-xs text-foreground-secondary">
                {result.alreadySubmitted
                  ? "This deposit had already been submitted; nothing was resent."
                  : "TDS is processing the registration. The deposit account number (DAN) will appear on the Deposits page once it is created."}
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
                  deposit that already has a batch reference will not be duplicated.
                </p>
              ) : null}

              {/* Property */}
              <section className="space-y-3">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  <Home className="h-3.5 w-3.5" /> Property
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field
                    label="Building name / number (PAON)"
                    hint="House number or name, e.g. 40 or The Corner House"
                    htmlFor="tds-paon"
                    error={errors.property?.paon?.message}
                  >
                    <Input id="tds-paon" {...register("property.paon")} />
                  </Field>
                  {SHOW_OPTIONAL_FIELDS && (
                    <Field
                      label="Sub-building (SAON)"
                      hint="Optional — e.g. Flat 6, Room 2"
                      htmlFor="tds-saon"
                      error={errors.property?.saon?.message}
                    >
                      <Input id="tds-saon" {...register("property.saon")} />
                    </Field>
                  )}
                  <Field
                    label="Street"
                    hint="Max 100 characters"
                    htmlFor="tds-street"
                    error={errors.property?.street?.message}
                  >
                    <Input id="tds-street" {...register("property.street")} />
                  </Field>
                  {SHOW_OPTIONAL_FIELDS && (
                    <Field
                      label="Locality"
                      hint="Optional — suburb / estate"
                      htmlFor="tds-locality"
                      error={errors.property?.locality?.message}
                    >
                      <Input id="tds-locality" {...register("property.locality")} />
                    </Field>
                  )}
                  <Field
                    label="Town"
                    hint="Min 3 characters"
                    htmlFor="tds-town"
                    error={errors.property?.town?.message}
                  >
                    <Input id="tds-town" {...register("property.town")} />
                  </Field>
                  <Field
                    label="County (administrative area)"
                    hint="Min 3 characters"
                    htmlFor="tds-county"
                    error={errors.property?.administrativeArea?.message}
                  >
                    <Input id="tds-county" {...register("property.administrativeArea")} />
                  </Field>
                  <Field
                    label="Postcode"
                    hint="Max 8 characters"
                    htmlFor="tds-postcode"
                    error={errors.property?.postcode?.message}
                  >
                    <Input id="tds-postcode" {...register("property.postcode")} />
                  </Field>
                  {SHOW_OPTIONAL_FIELDS && (
                    <Field
                      label="Furnished status"
                      hint="Optional"
                      htmlFor="tds-furnished"
                      error={errors.property?.furnishedStatus?.message}
                    >
                      <select
                        id="tds-furnished"
                        className={selectCls}
                        {...register("property.furnishedStatus", {
                          setValueAs: (v) => (v ? v : undefined),
                        })}
                      >
                        <option value="">Not specified</option>
                        {FURNISHED_STATUSES.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
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
                    htmlFor="tds-start"
                    error={errors.tenancy?.startDate?.message}
                  >
                    <Input id="tds-start" type="date" {...register("tenancy.startDate")} />
                  </Field>
                  <Field
                    label="Expected end date"
                    hint="Agreement end"
                    htmlFor="tds-end"
                    error={errors.tenancy?.endDate?.message}
                  >
                    <Input id="tds-end" type="date" {...register("tenancy.endDate")} />
                  </Field>
                  <Field
                    label="Deposit amount (£)"
                    hint="As per the tenancy agreement"
                    htmlFor="tds-deposit"
                    error={errors.tenancy?.depositAmount?.message}
                  >
                    <Input
                      id="tds-deposit"
                      type="number"
                      step="0.01"
                      {...register("tenancy.depositAmount")}
                    />
                  </Field>
                  <Field
                    label="Deposit received date"
                    hint="When you received the money"
                    htmlFor="tds-received"
                    error={errors.tenancy?.depositReceivedDate?.message}
                  >
                    <Input
                      id="tds-received"
                      type="date"
                      {...register("tenancy.depositReceivedDate")}
                    />
                  </Field>
                  {SHOW_OPTIONAL_FIELDS && (
                    <Field
                      label="Monthly rent (£)"
                      hint="Optional"
                      htmlFor="tds-rent"
                      error={errors.tenancy?.rentAmount?.message}
                    >
                      <Input id="tds-rent" type="number" step="0.01" {...register("tenancy.rentAmount")} />
                    </Field>
                  )}
                </div>
              </section>

              {/* Lead tenant */}
              <section className="space-y-3">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  <User className="h-3.5 w-3.5" /> Lead tenant
                </h3>
                <div className="rounded-lg border border-border p-3">
                  <PersonFields
                    prefix="leadTenant"
                    idPrefix="tds-lead"
                    register={register}
                    errors={errors.leadTenant}
                  />
                </div>
              </section>

              {/* Joint tenants */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                    Joint tenants
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => joint.append({ ...emptyPerson })}
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                {joint.fields.map((f, i) => (
                  <div key={f.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground-muted">
                        Joint tenant {i + 1}
                      </span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="xs"
                        onClick={() => joint.remove(i)}
                        aria-label="Remove joint tenant"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <PersonFields
                      prefix={`jointTenants.${i}`}
                      idPrefix={`tds-joint-${i}`}
                      register={register}
                      errors={errors.jointTenants?.[i]}
                    />
                  </div>
                ))}
              </section>

              {/* Guarantors / related parties */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                    Guarantors (related parties)
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => related.append({ ...emptyPerson })}
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                {related.fields.map((f, i) => (
                  <div key={f.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground-muted">
                        Guarantor {i + 1}
                      </span>
                      <Button
                        type="button"
                        variant="destructive"
                        size="xs"
                        onClick={() => related.remove(i)}
                        aria-label="Remove guarantor"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <PersonFields
                      prefix={`relatedParties.${i}`}
                      idPrefix={`tds-related-${i}`}
                      register={register}
                      errors={errors.relatedParties?.[i]}
                    />
                  </div>
                ))}
              </section>

              {/* Landlord */}
              <section className="space-y-3">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  <Building2 className="h-3.5 w-3.5" /> Primary landlord
                </h3>
                <div className="rounded-lg border border-border p-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Title" hint="e.g. Mr, Mrs" htmlFor="tds-ll-title" error={errors.landlord?.title?.message}>
                      <Input id="tds-ll-title" {...register("landlord.title")} />
                    </Field>
                    <Field label="First name" htmlFor="tds-ll-first" error={errors.landlord?.firstName?.message}>
                      <Input id="tds-ll-first" {...register("landlord.firstName")} />
                    </Field>
                    <Field label="Surname" htmlFor="tds-ll-surname" error={errors.landlord?.surname?.message}>
                      <Input id="tds-ll-surname" {...register("landlord.surname")} />
                    </Field>
                    {SHOW_OPTIONAL_FIELDS && (
                      <>
                        <Field label="Email" hint="Optional" htmlFor="tds-ll-email" error={errors.landlord?.email?.message}>
                          <Input id="tds-ll-email" type="email" {...register("landlord.email")} />
                        </Field>
                        <Field label="Mobile" hint="Optional" htmlFor="tds-ll-mobile" error={errors.landlord?.mobile?.message}>
                          <Input id="tds-ll-mobile" {...register("landlord.mobile")} />
                        </Field>
                      </>
                    )}
                  </div>

                  <label className="flex items-center gap-2 text-xs text-foreground">
                    <input type="checkbox" {...register("landlord.isBusiness")} />
                    Landlord is a business / organisation
                  </label>
                  {isBusiness ? (
                    <Field
                      label="Business name"
                      hint="Required for a business landlord"
                      htmlFor="tds-ll-business"
                      error={errors.landlord?.businessName?.message}
                    >
                      <Input id="tds-ll-business" {...register("landlord.businessName")} />
                    </Field>
                  ) : null}

                  <p className="pt-1 text-[11px] text-foreground-muted">
                    Landlord address (required — may be c/o the agent).
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Building name / number" htmlFor="tds-ll-paon" error={errors.landlord?.paon?.message}>
                      <Input id="tds-ll-paon" {...register("landlord.paon")} />
                    </Field>
                    {SHOW_OPTIONAL_FIELDS && (
                      <Field label="Sub-building (optional)" htmlFor="tds-ll-saon" error={errors.landlord?.saon?.message}>
                        <Input id="tds-ll-saon" {...register("landlord.saon")} />
                      </Field>
                    )}
                    <Field label="Street" htmlFor="tds-ll-street" error={errors.landlord?.street?.message}>
                      <Input id="tds-ll-street" {...register("landlord.street")} />
                    </Field>
                    {SHOW_OPTIONAL_FIELDS && (
                      <Field label="Locality (optional)" htmlFor="tds-ll-locality" error={errors.landlord?.locality?.message}>
                        <Input id="tds-ll-locality" {...register("landlord.locality")} />
                      </Field>
                    )}
                    <Field label="Town" htmlFor="tds-ll-town" error={errors.landlord?.town?.message}>
                      <Input id="tds-ll-town" {...register("landlord.town")} />
                    </Field>
                    <Field label="County" htmlFor="tds-ll-county" error={errors.landlord?.administrativeArea?.message}>
                      <Input id="tds-ll-county" {...register("landlord.administrativeArea")} />
                    </Field>
                    <Field label="Postcode" htmlFor="tds-ll-postcode" error={errors.landlord?.postcode?.message}>
                      <Input id="tds-ll-postcode" {...register("landlord.postcode")} />
                    </Field>
                    {SHOW_OPTIONAL_FIELDS && (
                      <Field label="Country" hint="Defaults to United Kingdom" htmlFor="tds-ll-country" error={errors.landlord?.country?.message}>
                        <Input id="tds-ll-country" {...register("landlord.country")} />
                      </Field>
                    )}
                  </div>
                </div>
              </section>

              {result && !result.ok ? (
                <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                  {result.error}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="secondary" loading={isSubmitting}>
                  <ShieldCheck className="h-4 w-4" />
                  Submit to TDS
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

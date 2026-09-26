"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { createCertificate, updateCertificate } from "../actions/certificates";
import {
  CERTIFICATE_TYPES,
  CERTIFICATE_TYPE_LABELS,
  type Certificate,
  type CertificateType,
} from "../domain/types";

// ──────────────────────────────────────────────────────────
// Schema (mirrored server-side in domain/types.ts)
// ──────────────────────────────────────────────────────────

const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const schema = z
  .object({
    propertyId: z.string().min(1, "Choose a property"),
    unitId: z.string().optional(),
    type: z.enum(CERTIFICATE_TYPES),
    issueDate: dateISO,
    expiryDate: dateISO,
    contractorId: z.string().optional(),
    reference: z.string().max(100, "Max 100 characters").optional(),
    notes: z.string().max(1000, "Max 1000 characters").optional(),
  })
  .refine((v) => v.expiryDate > v.issueDate, {
    message: "Expiry must be after the issue date",
    path: ["expiryDate"],
  });

type FormValues = z.infer<typeof schema>;

// ──────────────────────────────────────────────────────────
// Field wrapper — label above, hint under label, error below
// ──────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  hint: string;
  required?: boolean;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

function Field({ label, hint, required, error, htmlFor, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground mb-0.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <p className="text-[11px] text-foreground-muted mb-1.5">{hint}</p>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

const inputClass = (hasError: boolean) =>
  cn(
    "w-full rounded-xl border bg-surface-card px-3 py-2.5 md:py-2 text-base md:text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50",
    hasError ? "border-red-400" : "border-border"
  );

// ──────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────

interface CertificateModalProps {
  /** Pass an existing certificate to edit; omit to create. */
  certificate?: Certificate | null;
  /** Fixed property context (property page tab). */
  property?: { id: string; name: string } | null;
  /** Property chooser list (compliance dashboard). */
  properties?: Array<{ id: string; name: string }>;
  /** Unit options for the fixed property; empty hides the unit field. */
  units?: Array<{ id: string; label: string }>;
  suppliers: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

export function CertificateModal({
  certificate,
  property,
  properties = [],
  units = [],
  suppliers,
  onClose,
  onSuccess,
}: CertificateModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!certificate;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      propertyId: certificate?.property_id ?? property?.id ?? "",
      unitId: certificate?.unit_id ?? "",
      type: certificate?.type ?? "gas_safety",
      issueDate: certificate?.issue_date ?? "",
      expiryDate: certificate?.expiry_date ?? "",
      contractorId: certificate?.contractor_id ?? "",
      reference: certificate?.reference ?? "",
      notes: certificate?.notes ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const payload = {
        propertyId: values.propertyId,
        unitId: values.unitId || null,
        type: values.type as CertificateType,
        issueDate: values.issueDate,
        expiryDate: values.expiryDate,
        contractorId: values.contractorId || null,
        reference: values.reference ?? "",
        notes: values.notes ?? "",
      };
      const file = fileRef.current?.files?.[0];
      let formData: FormData | undefined;
      if (file) {
        formData = new FormData();
        formData.set("document", file);
      }
      const result = isEdit
        ? await updateCertificate(certificate!.id, payload, formData)
        : await createCertificate(payload, formData);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success(isEdit ? "Certificate updated" : "Certificate added");
        onSuccess();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Certificate"
        className="relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-bento bg-surface-card shadow-2xl sm:max-h-[85dvh] sm:rounded-bento"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? "Edit Certificate" : "Add Certificate"}
          </h2>
          <button
            onClick={onClose}
            title="Close without saving"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-inset hover:text-foreground sm:h-8 sm:w-8"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          {property ? (
            <input type="hidden" {...register("propertyId")} />
          ) : (
            <Field
              label="Property"
              hint="The property this certificate covers."
              required
              error={errors.propertyId?.message}
              htmlFor="cert-property"
            >
              <select
                id="cert-property"
                {...register("propertyId")}
                title="Certificates are tracked per property; room-level certificates can be attached from the property page"
                className={inputClass(!!errors.propertyId)}
              >
                <option value="">Choose a property…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Certificate type"
              hint="Statutory compliance certificate or licence."
              required
              error={errors.type?.message}
              htmlFor="cert-type"
            >
              <select
                id="cert-type"
                {...register("type")}
                title="Determines which compliance column this certificate fills on the dashboard"
                className={inputClass(!!errors.type)}
              >
                {CERTIFICATE_TYPES.map((t) => (
                  <option key={t} value={t}>{CERTIFICATE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </Field>

            {units.length > 0 ? (
              <Field
                label="Room / unit"
                hint="Optional. Leave as whole property unless the certificate covers one room."
                error={errors.unitId?.message}
                htmlFor="cert-unit"
              >
                <select
                  id="cert-unit"
                  {...register("unitId")}
                  title="Room-level certificates (e.g. a PAT test for one room's appliances) attach here"
                  className={inputClass(!!errors.unitId)}
                >
                  <option value="">Whole property</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field
                label="Reference"
                hint="Optional. Certificate or licence number. Max 100 characters."
                error={errors.reference?.message}
                htmlFor="cert-reference-narrow"
              >
                <input
                  id="cert-reference-narrow"
                  {...register("reference")}
                  placeholder="e.g. CP12-2026-0412"
                  className={inputClass(!!errors.reference)}
                />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Issue date"
              hint="Use DD/MM/YYYY via the date picker."
              required
              error={errors.issueDate?.message}
              htmlFor="cert-issue-date"
            >
              <input
                id="cert-issue-date"
                type="date"
                {...register("issueDate")}
                className={inputClass(!!errors.issueDate)}
              />
            </Field>

            <Field
              label="Expiry date"
              hint="Must be after the issue date. Drives the red / amber / green status."
              required
              error={errors.expiryDate?.message}
              htmlFor="cert-expiry-date"
            >
              <input
                id="cert-expiry-date"
                type="date"
                {...register("expiryDate")}
                title="Expiry automations (contractor chase, agency alert) fire off this date"
                className={inputClass(!!errors.expiryDate)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Contractor"
              hint="Optional. Who issued it — expiry automations chase them for renewal."
              error={errors.contractorId?.message}
              htmlFor="cert-contractor"
            >
              <select
                id="cert-contractor"
                {...register("contractorId")}
                title="From the maintenance suppliers directory; renewal chase emails go to this contractor"
                className={inputClass(!!errors.contractorId)}
              >
                <option value="">No contractor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>

            {units.length > 0 && (
              <Field
                label="Reference"
                hint="Optional. Certificate or licence number. Max 100 characters."
                error={errors.reference?.message}
                htmlFor="cert-reference"
              >
                <input
                  id="cert-reference"
                  {...register("reference")}
                  placeholder="e.g. CP12-2026-0412"
                  className={inputClass(!!errors.reference)}
                />
              </Field>
            )}
          </div>

          <Field
            label="Document"
            hint={
              isEdit
                ? "Optional. PDF or image up to 20 MB — replaces the current document."
                : "Optional. PDF or image up to 20 MB."
            }
            htmlFor="cert-document"
          >
            <input
              id="cert-document"
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              title="Stored privately; downloadable from the certificate list"
              className="min-h-11 md:min-h-0 w-full text-sm text-foreground-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-surface-inset file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
            />
          </Field>

          <Field
            label="Notes"
            hint="Optional. Remedial actions, C1/C2 codes, licensing conditions. Max 1000 characters."
            error={errors.notes?.message}
            htmlFor="cert-notes"
          >
            <textarea
              id="cert-notes"
              {...register("notes")}
              rows={2}
              placeholder="e.g. C2 remedial work completed 12 May"
              className={cn(inputClass(!!errors.notes), "resize-none")}
            />
          </Field>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              loading={submitting}
              title={isEdit ? "Save changes to this certificate" : "Add this certificate"}
            >
              {isEdit ? "Save Changes" : "Add Certificate"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

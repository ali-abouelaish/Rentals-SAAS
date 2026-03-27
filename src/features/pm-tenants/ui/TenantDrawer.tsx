"use client";

import { useState, useEffect, useTransition } from "react";
import { Pencil, Check, X, Plus, Trash2, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { RightToRentBadge } from "./RightToRentBadge";
import { updatePmTenant, deletePmTenant } from "../actions/pm-tenants";
import { createGuarantor, deleteGuarantor } from "../actions/guarantors";
import { pmTenantSchema, guarantorSchema, type PmTenantFormValues, type GuarantorFormValues } from "../domain/schemas";
import {
  EMPLOYMENT_STATUS_LABELS,
  RIGHT_TO_RENT_LABELS,
  type PmTenant,
  type Guarantor,
} from "../domain/types";

// ── helpers ────────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">{label}</span>
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputCls = "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const selectCls = "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "guarantors", label: "Guarantors" },
  { value: "documents", label: "Documents" },
  { value: "rtr", label: "Right to Rent" },
  { value: "emergency", label: "Emergency" },
  { value: "responses", label: "Responses" },
  { value: "history", label: "History" },
];

// ── Sub-tabs ───────────────────────────────────────────────────────────────────

function OverviewContent({
  tenant,
  isEditing,
  onSaved,
}: {
  tenant: PmTenant;
  isEditing: boolean;
  onSaved: (t: PmTenant) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PmTenantFormValues>({
    resolver: zodResolver(pmTenantSchema),
    defaultValues: {
      full_name: tenant.full_name,
      email: tenant.email,
      phone: tenant.phone,
      whatsapp_number: tenant.whatsapp_number ?? "",
      date_of_birth: tenant.date_of_birth ?? "",
      nationality: tenant.nationality ?? "",
      current_address: tenant.current_address ?? "",
      employment_status: tenant.employment_status ?? undefined,
      employer_name: tenant.employer_name ?? "",
      employer_address: tenant.employer_address ?? "",
      job_title: tenant.job_title ?? "",
      current_landlord_name: tenant.current_landlord_name ?? "",
      current_landlord_contact: tenant.current_landlord_contact ?? "",
      notes: tenant.notes ?? "",
    },
  });

  const onSubmit = (values: PmTenantFormValues) => {
    startTransition(async () => {
      try {
        const updated = await updatePmTenant(tenant.id, values);
        toast.success("Tenant updated");
        onSaved(updated as unknown as PmTenant);
      } catch {
        toast.error("Failed to update tenant");
      }
    });
  };

  if (!isEditing) {
    return (
      <div className="space-y-5 py-1">
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-3">Personal</h3>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Full name" value={tenant.full_name} />
            <InfoRow label="Date of birth" value={tenant.date_of_birth ? new Date(tenant.date_of_birth).toLocaleDateString("en-GB") : null} />
            <InfoRow label="Nationality" value={tenant.nationality} />
            <InfoRow label="Phone" value={tenant.phone} />
            <InfoRow label="Email" value={tenant.email} />
            <InfoRow label="WhatsApp" value={tenant.whatsapp_number} />
            <div className="col-span-2">
              <InfoRow label="Current address" value={tenant.current_address} />
            </div>
          </div>
        </section>
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-3">Employment</h3>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Status" value={tenant.employment_status ? EMPLOYMENT_STATUS_LABELS[tenant.employment_status] : null} />
            <InfoRow label="Employer" value={tenant.employer_name} />
            <InfoRow label="Job title" value={tenant.job_title} />
            <InfoRow label="Employer address" value={tenant.employer_address} />
          </div>
        </section>
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-3">Previous Landlord</h3>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Name" value={tenant.current_landlord_name} />
            <InfoRow label="Contact" value={tenant.current_landlord_contact} />
          </div>
        </section>
        {tenant.notes && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-2">Notes</h3>
            <p className="text-sm text-foreground whitespace-pre-wrap">{tenant.notes}</p>
          </section>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-1">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Full name *" error={errors.full_name?.message}>
          <input {...register("full_name")} className={inputCls} />
        </FormField>
        <FormField label="Date of birth">
          <input type="date" {...register("date_of_birth")} className={inputCls} />
        </FormField>
        <FormField label="Email *" error={errors.email?.message}>
          <input type="email" {...register("email")} className={inputCls} />
        </FormField>
        <FormField label="Phone *" error={errors.phone?.message}>
          <input {...register("phone")} className={inputCls} />
        </FormField>
        <FormField label="WhatsApp">
          <input {...register("whatsapp_number")} className={inputCls} />
        </FormField>
        <FormField label="Nationality">
          <input {...register("nationality")} className={inputCls} />
        </FormField>
      </div>
      <FormField label="Current address">
        <textarea {...register("current_address")} rows={2} className={`${inputCls} h-auto py-2`} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Employment status">
          <select {...register("employment_status")} className={selectCls}>
            <option value="">Select…</option>
            {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Employer / University">
          <input {...register("employer_name")} className={inputCls} />
        </FormField>
        <FormField label="Job title">
          <input {...register("job_title")} className={inputCls} />
        </FormField>
        <FormField label="Employer address">
          <input {...register("employer_address")} className={inputCls} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Previous landlord">
          <input {...register("current_landlord_name")} className={inputCls} />
        </FormField>
        <FormField label="Landlord contact">
          <input {...register("current_landlord_contact")} className={inputCls} />
        </FormField>
      </div>
      <FormField label="Notes">
        <textarea {...register("notes")} rows={3} className={`${inputCls} h-auto py-2`} />
      </FormField>
      <div className="flex justify-end pt-2">
        <Button type="submit" variant="secondary" size="sm" loading={isPending}>
          <Check className="h-3.5 w-3.5 mr-1" />
          Save changes
        </Button>
      </div>
    </form>
  );
}

function GuarantorsContent({ tenant, onTenantUpdated }: { tenant: PmTenant; onTenantUpdated: (t: PmTenant) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GuarantorFormValues>({
    resolver: zodResolver(guarantorSchema),
    defaultValues: { pm_tenant_id: tenant.id },
  });

  const handleAdd = (values: GuarantorFormValues) => {
    startTransition(async () => {
      try {
        await createGuarantor(values);
        toast.success("Guarantor added");
        reset({ pm_tenant_id: tenant.id });
        setShowForm(false);
        onTenantUpdated({ ...tenant, guarantors: [...(tenant.guarantors ?? []), values as unknown as Guarantor] });
      } catch {
        toast.error("Failed to add guarantor");
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Remove this guarantor?")) return;
    startTransition(async () => {
      try {
        await deleteGuarantor(id);
        toast.success("Guarantor removed");
        onTenantUpdated({ ...tenant, guarantors: (tenant.guarantors ?? []).filter((g) => g.id !== id) });
      } catch {
        toast.error("Failed to remove guarantor");
      }
    });
  };

  return (
    <div className="space-y-4 py-1">
      {(tenant.guarantors ?? []).length === 0 && !showForm && (
        <p className="text-sm text-foreground-secondary">No guarantors on file.</p>
      )}

      {(tenant.guarantors ?? []).map((g) => (
        <div key={g.id} className="rounded-lg border border-border bg-surface-inset p-3 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">{g.full_name}</p>
              {g.relationship && <p className="text-[11px] text-foreground-muted">{g.relationship}</p>}
            </div>
            <button
              type="button"
              onClick={() => handleDelete(g.id)}
              className="text-red-500 hover:text-red-600 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-foreground-secondary">{g.email} · {g.phone}</p>
        </div>
      ))}

      {showForm ? (
        <form onSubmit={handleSubmit(handleAdd)} className="rounded-lg border border-border bg-surface-inset p-4 space-y-3">
          <input type="hidden" {...register("pm_tenant_id")} />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Full name *" error={errors.full_name?.message}>
              <input {...register("full_name")} className={inputCls} />
            </FormField>
            <FormField label="Relationship">
              <input {...register("relationship")} placeholder="e.g. Parent" className={inputCls} />
            </FormField>
            <FormField label="Email *" error={errors.email?.message}>
              <input type="email" {...register("email")} className={inputCls} />
            </FormField>
            <FormField label="Phone *" error={errors.phone?.message}>
              <input {...register("phone")} className={inputCls} />
            </FormField>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>Add Guarantor</Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Guarantor
        </Button>
      )}
    </div>
  );
}

function RightToRentContent({ tenant, isEditing, onSaved }: { tenant: PmTenant; isEditing: boolean; onSaved: (t: PmTenant) => void }) {
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit } = useForm({
    defaultValues: {
      right_to_rent_type: tenant.right_to_rent_type ?? "",
      right_to_rent_code: tenant.right_to_rent_code ?? "",
      right_to_rent_expiry: tenant.right_to_rent_expiry ?? "",
      right_to_rent_verified: tenant.right_to_rent_verified,
    },
  });

  const onSubmit = (values: Record<string, unknown>) => {
    startTransition(async () => {
      try {
        const updated = await updatePmTenant(tenant.id, values as Partial<PmTenantFormValues>);
        toast.success("Right to Rent updated");
        onSaved(updated as unknown as PmTenant);
      } catch {
        toast.error("Failed to update");
      }
    });
  };

  return (
    <div className="space-y-4 py-1">
      <div className="flex items-center gap-3 mb-2">
        <RightToRentBadge tenant={tenant} showLabel />
      </div>

      {!isEditing ? (
        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="Document type" value={tenant.right_to_rent_type ? RIGHT_TO_RENT_LABELS[tenant.right_to_rent_type] : null} />
          <InfoRow label="Share code" value={tenant.right_to_rent_code} />
          <InfoRow label="Expiry date" value={tenant.right_to_rent_expiry ? new Date(tenant.right_to_rent_expiry).toLocaleDateString("en-GB") : null} />
          <InfoRow label="Verified" value={tenant.right_to_rent_verified ? "Yes" : "No"} />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Document type">
              <select {...register("right_to_rent_type")} className={selectCls}>
                <option value="">Select…</option>
                {Object.entries(RIGHT_TO_RENT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Share code">
              <input {...register("right_to_rent_code")} className={inputCls} placeholder="e.g. ABC 123 456" />
            </FormField>
            <FormField label="Expiry date">
              <input type="date" {...register("right_to_rent_expiry")} className={inputCls} />
            </FormField>
            <FormField label="Verified">
              <select {...register("right_to_rent_verified", { setValueAs: (v) => v === "true" })} className={selectCls}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </FormField>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              <Check className="h-3.5 w-3.5 mr-1" />
              Save
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function EmergencyContactContent({ tenant, isEditing, onSaved }: { tenant: PmTenant; isEditing: boolean; onSaved: (t: PmTenant) => void }) {
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit } = useForm({
    defaultValues: {
      emergency_contact_name: tenant.emergency_contact_name ?? "",
      emergency_contact_phone: tenant.emergency_contact_phone ?? "",
      emergency_contact_relationship: tenant.emergency_contact_relationship ?? "",
    },
  });

  const onSubmit = (values: Record<string, unknown>) => {
    startTransition(async () => {
      try {
        const updated = await updatePmTenant(tenant.id, values as Partial<PmTenantFormValues>);
        toast.success("Emergency contact updated");
        onSaved(updated as unknown as PmTenant);
      } catch {
        toast.error("Failed to update");
      }
    });
  };

  if (!isEditing) {
    return (
      <div className="grid grid-cols-2 gap-3 py-1">
        <InfoRow label="Name" value={tenant.emergency_contact_name} />
        <InfoRow label="Relationship" value={tenant.emergency_contact_relationship} />
        <InfoRow label="Phone" value={tenant.emergency_contact_phone} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 py-1">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Full name">
          <input {...register("emergency_contact_name")} className={inputCls} />
        </FormField>
        <FormField label="Relationship">
          <input {...register("emergency_contact_relationship")} className={inputCls} />
        </FormField>
        <FormField label="Phone">
          <input {...register("emergency_contact_phone")} className={inputCls} />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" size="sm" loading={isPending}>
          <Check className="h-3.5 w-3.5 mr-1" />
          Save
        </Button>
      </div>
    </form>
  );
}

function DocumentsContent({ tenant }: { tenant: PmTenant }) {
  return (
    <div className="space-y-4 py-1">
      <div className="rounded-lg border border-border bg-surface-inset p-4 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Passport Photo</p>
        {tenant.passport_photo_url ? (
          <a href={tenant.passport_photo_url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tenant.passport_photo_url} alt="Passport photo" className="w-32 h-32 object-cover rounded-lg border border-border" />
          </a>
        ) : (
          <p className="text-sm text-foreground-secondary">No passport photo uploaded.</p>
        )}
      </div>
      <div className="rounded-lg border border-border bg-surface-inset p-4 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Passport Scan</p>
        {tenant.passport_scan_url ? (
          <a
            href={tenant.passport_scan_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand hover:underline"
          >
            View passport scan
          </a>
        ) : (
          <p className="text-sm text-foreground-secondary">No passport scan uploaded.</p>
        )}
      </div>
      <p className="text-xs text-foreground-muted">
        Document uploads can be managed directly in Supabase Storage (pm-tenant-docs bucket).
      </p>
    </div>
  );
}

// ── Main drawer ────────────────────────────────────────────────────────────────

interface TenantDrawerProps {
  tenant: PmTenant | null;
  open: boolean;
  onClose: () => void;
  onTenantUpdated: (t: PmTenant) => void;
  formResponses?: Array<{ question: { question_text: string }; answer_text: string | null; answer_file_url: string | null }>;
  contractHistory?: Array<{ start_date: string; status: string; unit: { room_number: string | null; unit_type: string; property: { name: string; address_line_1: string } } }>;
}

export function TenantDrawer({
  tenant,
  open,
  onClose,
  onTenantUpdated,
  formResponses = [],
  contractHistory = [],
}: TenantDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [localTenant, setLocalTenant] = useState<PmTenant | null>(tenant);

  useEffect(() => {
    setLocalTenant(tenant);
    setIsEditing(false);
    setActiveTab("overview");
  }, [tenant?.id]);

  if (!localTenant) return null;

  const handleSaved = (updated: PmTenant) => {
    const merged = { ...localTenant, ...updated };
    setLocalTenant(merged);
    onTenantUpdated(merged);
    setIsEditing(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex flex-col p-0 w-full max-w-[896px]">
        {/* Header */}
        <SheetHeader className="shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <RightToRentBadge tenant={localTenant} />
              </div>
              <h2 className="text-base font-semibold text-foreground truncate">{localTenant.full_name}</h2>
              <p className="text-xs text-foreground-secondary">{localTenant.email} · {localTenant.phone}</p>
            </div>
            <Button
              type="button"
              variant={isEditing ? "secondary" : "outline"}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="h-8 shrink-0"
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              {isEditing ? "Editing" : "Edit"}
            </Button>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="border-b border-border px-6 pt-2 pb-0 shrink-0 overflow-x-auto">
          <div className="flex min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "px-3 py-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
                  activeTab === tab.value
                    ? "border-brand text-brand"
                    : "border-transparent text-foreground-secondary hover:text-foreground hover:border-border"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === "overview" && (
            <OverviewContent tenant={localTenant} isEditing={isEditing} onSaved={handleSaved} />
          )}
          {activeTab === "guarantors" && (
            <GuarantorsContent tenant={localTenant} onTenantUpdated={(t) => { setLocalTenant(t); onTenantUpdated(t); }} />
          )}
          {activeTab === "documents" && <DocumentsContent tenant={localTenant} />}
          {activeTab === "rtr" && (
            <RightToRentContent tenant={localTenant} isEditing={isEditing} onSaved={handleSaved} />
          )}
          {activeTab === "emergency" && (
            <EmergencyContactContent tenant={localTenant} isEditing={isEditing} onSaved={handleSaved} />
          )}
          {activeTab === "responses" && (
            <div className="space-y-4 py-1">
              {formResponses.length === 0 ? (
                <p className="text-sm text-foreground-secondary">No booking form responses linked to this tenant.</p>
              ) : (
                formResponses.map((r, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                      {r.question?.question_text}
                    </p>
                    {r.answer_file_url ? (
                      <a href={r.answer_file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:underline">
                        View file
                      </a>
                    ) : (
                      <p className="text-sm text-foreground">{r.answer_text || "—"}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          {activeTab === "history" && (
            <div className="space-y-3 py-1">
              {contractHistory.length === 0 ? (
                <p className="text-sm text-foreground-secondary">No contract history found.</p>
              ) : (
                contractHistory.map((c, i) => {
                  const unit = c.unit;
                  const label = unit.unit_type === "room"
                    ? unit.room_number ? `Room ${unit.room_number}` : "Room"
                    : unit.unit_type === "studio" ? "Studio" : "Whole Flat";
                  return (
                    <div key={i} className="rounded-lg border border-border bg-surface-inset p-3 space-y-1">
                      <p className="text-sm font-medium text-foreground">{unit.property.name} — {label}</p>
                      <p className="text-xs text-foreground-secondary">{unit.property.address_line_1}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-foreground-muted">From {new Date(c.start_date).toLocaleDateString("en-GB")}</span>
                        <span className={cn(
                          "text-[11px] px-2 py-0.5 rounded-full font-medium",
                          c.status === "active" ? "bg-green-100 text-green-700" :
                          c.status === "notice_given" ? "bg-amber-100 text-amber-700" :
                          c.status === "terminated" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-600"
                        )}>
                          {c.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

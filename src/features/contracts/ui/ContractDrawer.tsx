"use client";

import { useState, useEffect, useTransition } from "react";
import { Pencil, Check, AlertTriangle } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { ContractStatusBadge } from "./ContractStatusBadge";
import { DepositBadge } from "./DepositBadge";
import { GiveNoticeModal } from "./GiveNoticeModal";
import { ProRataField } from "./ProRataField";
import { updateContract } from "../actions/contracts";
import { contractSchema, type ContractFormValues } from "../domain/schemas";
import {
  CONTRACT_STATUS_CONFIG,
  DEPOSIT_SCHEME_LABELS,
  SIGNING_METHOD_LABELS,
  type PropertyContract,
  type ContractStatus,
  type DepositScheme,
  type SigningMethod,
} from "../domain/types";

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
  { value: "notice", label: "Notice" },
  { value: "deposit", label: "Deposit" },
  { value: "document", label: "Document" },
];

function OverviewContent({ contract, isEditing, onSaved }: { contract: PropertyContract; isEditing: boolean; onSaved: (c: PropertyContract) => void }) {
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      unit_id: contract.unit_id,
      pm_tenant_id: contract.pm_tenant_id,
      start_date: contract.start_date,
      expiry_date: contract.expiry_date ?? "",
      rent_pcm: contract.rent_pcm,
      deposit: contract.deposit,
      collection_date: contract.collection_date ?? undefined,
      pro_rata_amount: contract.pro_rata_amount,
      prepaid_first_full_month: contract.prepaid_first_full_month,
      deposit_scheme: contract.deposit_scheme,
      deposit_scheme_ref: contract.deposit_scheme_ref ?? "",
      deposit_protected_date: contract.deposit_protected_date ?? "",
      deposit_protection_alert: contract.deposit_protection_alert,
      signing_method: contract.signing_method ?? undefined,
      status: contract.status,
      document_url: contract.document_url ?? "",
      notes: contract.notes ?? "",
    },
  });

  const watchedStart = watch("start_date");
  const watchedRent = watch("rent_pcm");

  const onSubmit = (values: ContractFormValues) => {
    startTransition(async () => {
      try {
        const updated = await updateContract(contract.id, values);
        toast.success("Contract saved");
        onSaved(updated as unknown as PropertyContract);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save contract");
      }
    });
  };

  if (!isEditing) {
    return (
      <div className="space-y-5 py-1">
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-3">Parties</h3>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Tenant" value={contract.pm_tenant?.full_name} />
            <InfoRow label="Contact" value={contract.pm_tenant?.phone} />
            <InfoRow label="Unit" value={contract.unit ? `${contract.unit.property.name} — ${contract.unit.unit_type === "room" && contract.unit.room_number ? `Room ${contract.unit.room_number}` : contract.unit.unit_type}` : null} />
          </div>
        </section>
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-3">Terms</h3>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Start date" value={new Date(contract.start_date).toLocaleDateString("en-GB")} />
            <InfoRow label="Expiry date" value={contract.expiry_date ? new Date(contract.expiry_date).toLocaleDateString("en-GB") : "Rolling / periodic"} />
            <InfoRow label="Rent PCM" value={`£${contract.rent_pcm.toLocaleString()}`} />
            <InfoRow label="Deposit" value={`£${contract.deposit.toLocaleString()}`} />
            <InfoRow label="Collection day" value={contract.collection_date ? `${contract.collection_date}${["st","nd","rd"][(contract.collection_date - 1) % 10] ?? "th"} of month` : null} />
            <InfoRow
              label="First-period pro-rata"
              value={
                contract.pro_rata_amount != null
                  ? `£${Number(contract.pro_rata_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : null
              }
            />
            <InfoRow
              label="First full month upfront"
              value={contract.prepaid_first_full_month ? "Paid in advance" : "No"}
            />
            <InfoRow label="Signing method" value={contract.signing_method ? SIGNING_METHOD_LABELS[contract.signing_method] : null} />
          </div>
        </section>
        {contract.notes && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-2">Notes</h3>
            <p className="text-sm text-foreground whitespace-pre-wrap">{contract.notes}</p>
          </section>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-1">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Start date *" error={errors.start_date?.message}>
          <input type="date" {...register("start_date")} className={inputCls} />
        </FormField>
        <FormField label="Expiry date" error={errors.expiry_date?.message}>
          <input type="date" {...register("expiry_date")} className={inputCls} />
        </FormField>
        <FormField label="Collection day">
          <input type="number" min="1" max="31" {...register("collection_date")} className={inputCls} />
        </FormField>
        <FormField label="Rent PCM (£) *" error={errors.rent_pcm?.message}>
          <input type="number" {...register("rent_pcm")} className={inputCls} />
        </FormField>
        <FormField label="Deposit (£) *" error={errors.deposit?.message}>
          <input type="number" {...register("deposit")} className={inputCls} />
        </FormField>
      </div>
      <Controller
        name="pro_rata_amount"
        control={control}
        render={({ field: proRataField }) => (
          <Controller
            name="prepaid_first_full_month"
            control={control}
            render={({ field: prepaidField }) => (
              <ProRataField
                startDate={watchedStart}
                rentPcm={watchedRent ? Number(watchedRent) : undefined}
                proRataValue={proRataField.value ?? null}
                onProRataChange={proRataField.onChange}
                prepaidValue={!!prepaidField.value}
                onPrepaidChange={prepaidField.onChange}
              />
            )}
          />
        )}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Status">
          <select {...register("status")} className={selectCls}>
            {Object.entries(CONTRACT_STATUS_CONFIG).map(([v, cfg]) => (
              <option key={v} value={v}>{cfg.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Signing method">
          <select {...register("signing_method")} className={selectCls}>
            <option value="">Select…</option>
            {Object.entries(SIGNING_METHOD_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
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

function NoticeContent({ contract, onGiveNotice }: { contract: PropertyContract; onGiveNotice: () => void }) {
  if (contract.notice_given_date) {
    return (
      <div className="space-y-4 py-1">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-800">Notice has been given</p>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Given by" value={contract.notice_given_by ? contract.notice_given_by.charAt(0).toUpperCase() + contract.notice_given_by.slice(1) : null} />
            <InfoRow label="Notice date" value={contract.notice_given_date ? new Date(contract.notice_given_date).toLocaleDateString("en-GB") : null} />
            <InfoRow label="Vacate date" value={contract.vacate_date ? new Date(contract.vacate_date).toLocaleDateString("en-GB") : null} />
            {contract.vacate_date && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">Days remaining</span>
                <span className="text-sm font-medium text-amber-700">
                  {Math.max(0, differenceInDays(new Date(contract.vacate_date), new Date()))} days
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-1">
      <p className="text-sm text-foreground-secondary">
        All contracts are periodic/rolling (Renters Rights Act 2025). Either party can give 2 months notice to terminate.
      </p>
      <Button
        type="button"
        variant="secondary"
        onClick={onGiveNotice}
        disabled={["terminated", "notice_given"].includes(contract.status)}
      >
        Give Notice
      </Button>
      {["terminated", "notice_given"].includes(contract.status) && (
        <p className="text-xs text-foreground-muted">Notice has already been recorded or contract is terminated.</p>
      )}
    </div>
  );
}

function DepositContent({ contract, isEditing, onSaved }: { contract: PropertyContract; isEditing: boolean; onSaved: (c: PropertyContract) => void }) {
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit } = useForm({
    defaultValues: {
      deposit_scheme: contract.deposit_scheme,
      deposit_scheme_ref: contract.deposit_scheme_ref ?? "",
      deposit_protected_date: contract.deposit_protected_date ?? "",
      deposit_protection_alert: contract.deposit_protection_alert,
    },
  });

  const onSubmit = (values: Record<string, unknown>) => {
    startTransition(async () => {
      try {
        const updated = await updateContract(contract.id, values as Partial<ContractFormValues>);
        toast.success("Deposit info saved");
        onSaved(updated as unknown as PropertyContract);
      } catch {
        toast.error("Failed to save");
      }
    });
  };

  const today = new Date();
  const deadline = contract.deposit_protection_deadline ? new Date(contract.deposit_protection_deadline) : null;
  const daysToDeadline = deadline ? differenceInDays(deadline, today) : null;

  return (
    <div className="space-y-4 py-1">
      {/* Alert */}
      {!contract.deposit_protected_date && daysToDeadline !== null && daysToDeadline <= 7 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Deposit protection deadline approaching</p>
            <p className="text-xs text-red-700 mt-0.5">
              {daysToDeadline < 0
                ? "Deadline passed — landlord may face 3× deposit penalty."
                : `${daysToDeadline} day${daysToDeadline !== 1 ? "s" : ""} left to register with a scheme.`}
            </p>
          </div>
        </div>
      )}

      {!isEditing ? (
        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="Deposit amount" value={`£${contract.deposit.toLocaleString()}`} />
          <InfoRow label="Scheme" value={DEPOSIT_SCHEME_LABELS[contract.deposit_scheme]} />
          <InfoRow label="Scheme ref" value={contract.deposit_scheme_ref} />
          <InfoRow label="Protected date" value={contract.deposit_protected_date ? new Date(contract.deposit_protected_date).toLocaleDateString("en-GB") : null} />
          <InfoRow label="Deadline" value={contract.deposit_protection_deadline ? new Date(contract.deposit_protection_deadline).toLocaleDateString("en-GB") : null} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">Status</span>
            <DepositBadge contract={contract} />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Deposit scheme">
              <select {...register("deposit_scheme")} className={selectCls}>
                {Object.entries(DEPOSIT_SCHEME_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Scheme reference">
              <input {...register("deposit_scheme_ref")} className={inputCls} />
            </FormField>
            <FormField label="Date protected">
              <input type="date" {...register("deposit_protected_date")} className={inputCls} />
            </FormField>
            <FormField label="Alert before deadline">
              <select {...register("deposit_protection_alert", { setValueAs: (v) => v === "true" })} className={selectCls}>
                <option value="true">Yes</option>
                <option value="false">No</option>
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

function DocumentContent({ contract, isEditing, onSaved }: { contract: PropertyContract; isEditing: boolean; onSaved: (c: PropertyContract) => void }) {
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit } = useForm({
    defaultValues: { document_url: contract.document_url ?? "" },
  });

  const onSubmit = (values: { document_url: string }) => {
    startTransition(async () => {
      try {
        const updated = await updateContract(contract.id, values as Partial<ContractFormValues>);
        toast.success("Document link saved");
        onSaved(updated as unknown as PropertyContract);
      } catch {
        toast.error("Failed to save");
      }
    });
  };

  return (
    <div className="space-y-4 py-1">
      {contract.document_url ? (
        <div className="space-y-2">
          <a
            href={contract.document_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
          >
            View / download contract document
          </a>
        </div>
      ) : (
        <p className="text-sm text-foreground-secondary">No document linked yet.</p>
      )}
      {isEditing && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <FormField label="Document URL (PDF link or Drive link)">
            <input {...register("document_url")} className={inputCls} placeholder="https://…" />
          </FormField>
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

// ── Main Drawer ────────────────────────────────────────────────────────────────

interface ContractDrawerProps {
  contract: PropertyContract | null;
  open: boolean;
  onClose: () => void;
  onContractUpdated: (c: PropertyContract) => void;
}

export function ContractDrawer({ contract, open, onClose, onContractUpdated }: ContractDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [localContract, setLocalContract] = useState<PropertyContract | null>(contract);
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);

  useEffect(() => {
    setLocalContract(contract);
    setIsEditing(false);
    setActiveTab("overview");
  }, [contract?.id]);

  if (!localContract) return null;

  const handleSaved = (updated: PropertyContract) => {
    const merged = { ...localContract, ...updated };
    setLocalContract(merged);
    onContractUpdated(merged);
    setIsEditing(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex flex-col p-0 w-full max-w-[560px]">
        {/* Header */}
        <SheetHeader className="shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <ContractStatusBadge status={localContract.status} />
              <h2 className="text-base font-semibold text-foreground truncate">
                {localContract.pm_tenant?.full_name ?? "Contract"}
              </h2>
              <p className="text-xs text-foreground-secondary">
                £{localContract.rent_pcm.toLocaleString()}/mo · from{" "}
                {new Date(localContract.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
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
        <div className="border-b border-border px-6 pt-2 pb-0 shrink-0">
          <div className="flex">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-px",
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
            <OverviewContent contract={localContract} isEditing={isEditing} onSaved={handleSaved} />
          )}
          {activeTab === "notice" && (
            <NoticeContent contract={localContract} onGiveNotice={() => setNoticeModalOpen(true)} />
          )}
          {activeTab === "deposit" && (
            <DepositContent contract={localContract} isEditing={isEditing} onSaved={handleSaved} />
          )}
          {activeTab === "document" && (
            <DocumentContent contract={localContract} isEditing={isEditing} onSaved={handleSaved} />
          )}
        </div>
      </SheetContent>

      <GiveNoticeModal
        contractId={localContract.id}
        open={noticeModalOpen}
        onClose={() => setNoticeModalOpen(false)}
        onSuccess={() => {
          setLocalContract((prev) =>
            prev ? { ...prev, status: "notice_given" } : prev
          );
          onContractUpdated({ ...localContract, status: "notice_given" });
        }}
      />
    </Sheet>
  );
}

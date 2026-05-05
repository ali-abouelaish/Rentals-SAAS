"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { User, UserPlus, X, Check, Search, FileSignature, PoundSterling } from "lucide-react";
import { TenancyPaymentsList } from "@/features/contracts/ui/TenancyPaymentsList";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils/cn";
import { updateUnit } from "../actions/units";
import { createContract, uploadContractDocument } from "@/features/contracts/actions/contracts";
import { contractSchema, type ContractFormValues } from "@/features/contracts/domain/schemas";
import { ProRataField } from "@/features/contracts/ui/ProRataField";
import { CONTRACT_STATUS_CONFIG, DEPOSIT_SCHEME_LABELS, SIGNING_METHOD_LABELS } from "@/features/contracts/domain/types";
import type { Unit } from "../domain/types";

interface PmTenantOption {
  id: string;
  full_name: string;
  email: string;
  phone: string;
}

function RentPaymentsCard({ unit }: { unit: Unit }) {
  const contract = unit.current_contract ?? null;

  if (!contract) {
    return (
      <div className="rounded-lg border border-border bg-surface-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <PoundSterling className="h-3.5 w-3.5 text-foreground-muted" />
          <p className="text-sm font-semibold text-foreground">Rent payments</p>
        </div>
        <p className="text-xs text-foreground-secondary">
          Create a contract first — rent payments are tracked per contract. Past
          tenancies are visible under the <span className="font-medium">History</span> tab.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <PoundSterling className="h-3.5 w-3.5 text-foreground-muted" />
        <p className="text-sm font-semibold text-foreground">Rent payments</p>
      </div>
      <TenancyPaymentsList
        contractId={contract.id}
        rentPence={contract.rent_pcm ?? 0}
        startDate={contract.start_date}
        endDate={null}
        proRataAmount={contract.pro_rata_amount ?? null}
      />
    </div>
  );
}

interface TenantTabProps {
  unit: Unit;
  onUnitUpdated: (unit: Unit) => void;
  pmTenants: PmTenantOption[];
}

const inputCls = "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const selectCls = "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function CreateContractDialog({
  open,
  onClose,
  unit,
  pmTenants,
  preselectedTenantId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  unit: Unit;
  pmTenants: PmTenantOption[];
  preselectedTenantId?: string;
  onCreated: (contract: {
    id: string;
    start_date: string;
    status: string;
    document_url: string | null;
    rent_pcm: number | null;
    deposit: number | null;
    pm_tenant_id: string | null;
    pro_rata_amount: number | null;
  }) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const unitLabel = unit.unit_type === "room" && unit.room_number
    ? `Room ${unit.room_number}`
    : unit.unit_type;

  const tenantOptions = pmTenants.map((t) => ({
    value: t.id,
    label: t.full_name,
    sublabel: t.phone,
  }));

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      unit_id: unit.id,
      pm_tenant_id: preselectedTenantId ?? "",
      deposit_scheme: "none",
      deposit_protection_alert: true,
      status: "draft",
      pro_rata_amount: null,
    },
  });

  const watchedStart = watch("start_date");
  const watchedRent = watch("rent_pcm");

  const handleCreate = (values: ContractFormValues) => {
    startTransition(async () => {
      try {
        const created = (await createContract(values)) as {
          id: string;
          start_date: string;
          status: string;
          document_url: string | null;
          rent_pcm: number | null;
          deposit: number | null;
          pm_tenant_id: string | null;
          pro_rata_amount: number | null;
        };
        toast.success("Contract created");
        onCreated(created);
        // Refresh server data so unit.status / pm_tenant_id (auto-occupy logic) are picked up
        router.refresh();
        reset();
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create contract");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Contract — {unit.property?.name} · {unitLabel}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <FormField label="Tenant *" error={errors.pm_tenant_id?.message}>
                <Controller
                  name="pm_tenant_id"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      options={tenantOptions}
                      placeholder="Search tenants…"
                      error={!!errors.pm_tenant_id}
                    />
                  )}
                />
              </FormField>
            </div>
            <FormField label="Start date *" error={errors.start_date?.message}>
              <input type="date" {...register("start_date")} className={inputCls} />
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
            <FormField label="Deposit scheme">
              <select {...register("deposit_scheme")} className={selectCls}>
                {Object.entries(DEPOSIT_SCHEME_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
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
            <div className="col-span-2">
              <Controller
                name="pro_rata_amount"
                control={control}
                render={({ field }) => (
                  <ProRataField
                    startDate={watchedStart}
                    rentPcm={watchedRent ? Number(watchedRent) : undefined}
                    value={field.value ?? null}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              Create Contract
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContractCard({
  unit,
  onUnitUpdated,
  onCreateContract,
}: {
  unit: Unit;
  onUnitUpdated: (unit: Unit) => void;
  onCreateContract: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const contract = unit.current_contract ?? null;

  const handleUpload = (file: File) => {
    if (!contract?.id) return;
    setUploading(true);
    const formData = new FormData();
    formData.set("contract_id", contract.id);
    formData.set("file", file);
    uploadContractDocument(formData)
      .then((updated) => {
        toast.success("Contract uploaded");
        const c = updated as {
          id: string;
          start_date: string;
          status: string;
          document_url: string | null;
          rent_pcm: number | null;
          deposit: number | null;
          pm_tenant_id: string | null;
          pro_rata_amount: number | null;
        };
        onUnitUpdated({
          ...unit,
          current_contract: {
            id: c.id,
            start_date: c.start_date,
            status: c.status,
            document_url: c.document_url,
            rent_pcm: c.rent_pcm,
            deposit: c.deposit,
            pm_tenant_id: c.pm_tenant_id,
            pro_rata_amount: c.pro_rata_amount,
          },
        });
      })
      .catch(() => toast.error("Failed to upload contract"))
      .finally(() => setUploading(false));
  };

  if (!contract) {
    return (
      <div className="rounded-lg border border-border bg-surface-card p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Contract</p>
          <p className="text-xs text-foreground-secondary mt-0.5">
            No contract yet for this tenant and unit.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCreateContract}
          className="w-full"
        >
          <FileSignature className="h-3.5 w-3.5 mr-1.5" />
          New Contract
        </Button>
      </div>
    );
  }

  const statusCfg = CONTRACT_STATUS_CONFIG[contract.status as keyof typeof CONTRACT_STATUS_CONFIG];

  return (
    <div className="rounded-lg border border-border bg-surface-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Contract</p>
          <p className="text-xs text-foreground-secondary mt-0.5">
            From {new Date(contract.start_date).toLocaleDateString("en-GB")}
            {contract.rent_pcm ? ` · £${contract.rent_pcm}/mo` : ""}
          </p>
        </div>
        {statusCfg && (
          <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", statusCfg.bg, statusCfg.fg)}>
            {statusCfg.label}
          </span>
        )}
      </div>

      {contract.document_url ? (
        <a
          href={contract.document_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-brand hover:underline"
        >
          View contract document
        </a>
      ) : (
        <p className="text-sm text-foreground-secondary">No document uploaded.</p>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-foreground-muted" htmlFor="unit-contract-doc-input">
          {contract.document_url ? "Replace contract" : "Upload contract"}
        </label>
        <input
          id="unit-contract-doc-input"
          type="file"
          accept="application/pdf,image/*"
          disabled={uploading}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-inset file:px-3 file:py-1 file:text-xs file:font-medium file:text-foreground file:cursor-pointer disabled:opacity-50"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
        {uploading && <p className="text-xs text-foreground-muted">Uploading…</p>}
      </div>
    </div>
  );
}

export function TenantTab({ unit, onUnitUpdated, pmTenants }: TenantTabProps) {
  const [isPending, startTransition] = useTransition();
  const [linking, setLinking] = useState(false);
  const [search, setSearch] = useState("");
  const [contractDialogOpen, setContractDialogOpen] = useState(false);

  const current = unit.pm_tenant ?? null;

  const handleLink = (tenant: PmTenantOption) => {
    startTransition(async () => {
      try {
        // Promote vacant-ish statuses to "occupied" so list/Kanban reflects the assignment.
        const vacantStatuses = ["available", "on_hold", "booked"];
        const nextStatus = vacantStatuses.includes(unit.status) ? "occupied" : unit.status;
        await updateUnit(unit.id, {
          pm_tenant_id: tenant.id,
          status: nextStatus,
        } as never);
        onUnitUpdated({ ...unit, pm_tenant_id: tenant.id, pm_tenant: tenant, status: nextStatus });
        setLinking(false);
        setSearch("");
        toast.success(`${tenant.full_name} linked to this unit`);
      } catch {
        toast.error("Failed to link tenant");
      }
    });
  };

  const handleUnlink = () => {
    startTransition(async () => {
      try {
        // Drop back to "available" if the unit was occupied via this assignment.
        const nextStatus = unit.status === "occupied" ? "available" : unit.status;
        await updateUnit(unit.id, {
          pm_tenant_id: null,
          status: nextStatus,
        } as never);
        onUnitUpdated({ ...unit, pm_tenant_id: null, pm_tenant: null, status: nextStatus });
        toast.success("Tenant unlinked");
      } catch {
        toast.error("Failed to unlink tenant");
      }
    });
  };

  const filtered = pmTenants.filter((t) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      t.full_name.toLowerCase().includes(s) ||
      t.email.toLowerCase().includes(s) ||
      t.phone.toLowerCase().includes(s)
    );
  });

  // ── Currently linked ──────────────────────────────────────────────────────
  if (current && !linking) {
    return (
      <>
        <div className="space-y-4 py-1">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-inset border border-border">
            <div className="h-10 w-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-brand">
                {current.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{current.full_name}</p>
              <p className="text-xs text-foreground-secondary truncate">{current.email}</p>
              <p className="text-xs text-foreground-muted">{current.phone}</p>
            </div>
            <button
              type="button"
              onClick={handleUnlink}
              disabled={isPending}
              title="Unlink tenant from unit"
              className="shrink-0 p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ContractCard
            unit={unit}
            onUnitUpdated={onUnitUpdated}
            onCreateContract={() => setContractDialogOpen(true)}
          />

          <RentPaymentsCard unit={unit} />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLinking(true)}
            className="w-full"
          >
            Reassign to a different tenant
          </Button>
        </div>

        <CreateContractDialog
          open={contractDialogOpen}
          onClose={() => setContractDialogOpen(false)}
          unit={unit}
          pmTenants={pmTenants}
          preselectedTenantId={current.id}
          onCreated={(contract) => onUnitUpdated({ ...unit, current_contract: contract })}
        />
      </>
    );
  }

  // ── Assign / reassign picker ──────────────────────────────────────────────
  return (
    <>
      <div className="space-y-3 py-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {linking ? "Reassign tenant" : "Assign tenant to unit"}
          </h3>
          {linking && (
            <button
              type="button"
              onClick={() => { setLinking(false); setSearch(""); }}
              className="text-xs text-foreground-muted hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>

        {pmTenants.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <User className="h-8 w-8 text-foreground-muted mx-auto mb-2" />
            <p className="text-sm text-foreground-secondary">No tenants found.</p>
            <p className="text-xs text-foreground-muted mt-1">
              Add tenants from the <span className="font-medium">Tenants</span> module first,
              or approve a booking to auto-create one.
            </p>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, email or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-surface-inset pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                autoFocus
              />
            </div>

            <div className="space-y-1 max-h-72 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-foreground-muted py-6">No matches</p>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={isPending || t.id === current?.id}
                    onClick={() => handleLink(t)}
                    className="w-full flex items-center gap-3 rounded-xl border border-border bg-surface-card px-3 py-2.5 text-left hover:bg-surface-inset transition-colors disabled:opacity-50"
                  >
                    <div className="h-8 w-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-brand">
                        {t.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.full_name}</p>
                      <p className="text-[11px] text-foreground-muted truncate">{t.email} · {t.phone}</p>
                    </div>
                    {t.id === current?.id ? (
                      <Check className="h-4 w-4 text-brand shrink-0" />
                    ) : (
                      <UserPlus className="h-4 w-4 text-foreground-muted shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {/* Allow creating contract without linking first */}
        {!linking && pmTenants.length > 0 && (
          <div className="pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setContractDialogOpen(true)}
              className="w-full"
            >
              <FileSignature className="h-3.5 w-3.5 mr-1.5" />
              New Contract for this unit
            </Button>
          </div>
        )}
      </div>

      <CreateContractDialog
        open={contractDialogOpen}
        onClose={() => setContractDialogOpen(false)}
        unit={unit}
        pmTenants={pmTenants}
        onCreated={(contract) => onUnitUpdated({ ...unit, current_contract: contract })}
      />
    </>
  );
}

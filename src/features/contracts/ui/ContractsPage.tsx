"use client";

import { useState, useMemo, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ContractFilterBar } from "./ContractFilterBar";
import { ContractsListView } from "./ContractsListView";
import { ContractDrawer } from "./ContractDrawer";
import { createContract } from "../actions/contracts";
import { contractSchema, type ContractFormValues } from "../domain/schemas";
import { DEPOSIT_SCHEME_LABELS, SIGNING_METHOD_LABELS, type ContractFilters } from "../domain/types";
import type { PropertyContract } from "../domain/types";
import type { Portfolio } from "@/features/properties/domain/types";

const DEFAULT_FILTERS: ContractFilters = {
  search: "",
  portfolioId: "",
  status: "",
  depositProtected: "",
};

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

interface ContractsPageProps {
  initialContracts: PropertyContract[];
  portfolios: Portfolio[];
  units: Array<{ id: string; room_number: string | null; unit_type: string; property: { name: string } }>;
  pmTenants: Array<{ id: string; full_name: string }>;
}

export function ContractsPage({ initialContracts, portfolios, units, pmTenants }: ContractsPageProps) {
  const [contracts, setContracts] = useState<PropertyContract[]>(initialContracts);
  const [filters, setFilters] = useState<ContractFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: { deposit_scheme: "none", deposit_protection_alert: true, status: "draft" },
  });

  const unitOptions = units.map((u) => ({
    value: u.id,
    label: `${u.property.name} — ${u.unit_type === "room" && u.room_number ? `Room ${u.room_number}` : u.unit_type}`,
  }));

  const tenantOptions = pmTenants.map((t) => ({
    value: t.id,
    label: t.full_name,
  }));

  const filteredContracts = useMemo(() => {
    let result = contracts;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(
        (c) =>
          c.pm_tenant?.full_name.toLowerCase().includes(s) ||
          c.unit?.property.name.toLowerCase().includes(s)
      );
    }
    if (filters.status) result = result.filter((c) => c.status === filters.status);
    if (filters.depositProtected === "yes") result = result.filter((c) => !!c.deposit_protected_date);
    if (filters.depositProtected === "no") result = result.filter((c) => !c.deposit_protected_date);
    return result;
  }, [contracts, filters]);

  const selectedContract = contracts.find((c) => c.id === selectedId) ?? null;

  const handleCreate = (values: ContractFormValues) => {
    startTransition(async () => {
      try {
        await createContract(values);
        toast.success("Contract created");
        reset();
        setCreateOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create contract");
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Contracts</h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            {contracts.length} contract{contracts.length !== 1 ? "s" : ""} · all periodic/rolling
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New contract
        </Button>
      </div>

      <ContractFilterBar
        filters={filters}
        onChange={setFilters}
        portfolios={portfolios}
        total={filteredContracts.length}
      />

      <ContractsListView
        contracts={filteredContracts}
        onContractClick={(id) => {
          setSelectedId(id);
          setDrawerOpen(true);
        }}
      />

      <ContractDrawer
        contract={selectedContract}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onContractUpdated={(updated) => {
          setContracts((prev) =>
            prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
          );
        }}
      />

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) reset(); setCreateOpen(o); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Contract</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleCreate)} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <FormField label="Unit *" error={errors.unit_id?.message}>
                  <Controller
                    name="unit_id"
                    control={control}
                    defaultValue=""
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        options={unitOptions}
                        placeholder="Search units…"
                        error={!!errors.unit_id}
                      />
                    )}
                  />
                </FormField>
              </div>
              <div className="col-span-2">
                <FormField label="Tenant *" error={errors.pm_tenant_id?.message}>
                  <Controller
                    name="pm_tenant_id"
                    control={control}
                    defaultValue=""
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
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => { reset(); setCreateOpen(false); }}>Cancel</Button>
              <Button type="submit" variant="secondary" size="sm" loading={isPending}>Create Contract</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

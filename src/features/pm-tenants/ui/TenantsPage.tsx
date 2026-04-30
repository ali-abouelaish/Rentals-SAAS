"use client";

import { useState, useMemo, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TenantFilterBar } from "./TenantFilterBar";
import { TenantsListView } from "./TenantsListView";
import { TenantDrawer } from "./TenantDrawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { pmTenantSchema, type PmTenantFormValues } from "../domain/schemas";
import { createPmTenant } from "../actions/pm-tenants";
import { EMPLOYMENT_STATUS_LABELS } from "../domain/types";
import type { PmTenant, PmTenantFilters } from "../domain/types";
import type { ReminderStatusMap } from "@/features/reminders/data/status";

const DEFAULT_FILTERS: PmTenantFilters = {
  search: "",
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

interface TenantsPageProps {
  initialTenants: PmTenant[];
  reminderStatus?: ReminderStatusMap;
}

export function TenantsPage({ initialTenants, reminderStatus }: TenantsPageProps) {
  const [tenants, setTenants] = useState<PmTenant[]>(initialTenants);
  const [filters, setFilters] = useState<PmTenantFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PmTenantFormValues>({
    resolver: zodResolver(pmTenantSchema),
  });

  const filteredTenants = useMemo(() => {
    if (!filters.search) return tenants;
    const s = filters.search.toLowerCase();
    return tenants.filter(
      (t) =>
        t.full_name.toLowerCase().includes(s) ||
        t.email.toLowerCase().includes(s) ||
        t.phone.includes(s)
    );
  }, [tenants, filters]);

  const selectedTenant = tenants.find((t) => t.id === selectedId) ?? null;

  const handleCreate = (values: PmTenantFormValues) => {
    startTransition(async () => {
      try {
        const created = await createPmTenant(values);
        toast.success("Tenant created");
        setTenants((prev) => [...prev, created as unknown as PmTenant]);
        reset();
        setCreateOpen(false);
      } catch {
        toast.error("Failed to create tenant");
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Tenants</h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            {tenants.length} tenant{tenants.length !== 1 ? "s" : ""} · property management profiles
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add tenant
        </Button>
      </div>

      {/* Filters */}
      <TenantFilterBar
        filters={filters}
        onChange={setFilters}
        total={filteredTenants.length}
      />

      {/* List */}
      <TenantsListView
        tenants={filteredTenants}
        reminderStatus={reminderStatus ?? {}}
        onTenantClick={(id) => {
          setSelectedId(id);
          setDrawerOpen(true);
        }}
      />

      {/* Drawer */}
      <TenantDrawer
        tenant={selectedTenant}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onTenantUpdated={(updated) => {
          setTenants((prev) =>
            prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
          );
        }}
      />

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Tenant</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleCreate)} className="space-y-4 mt-2">
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
              <FormField label="Nationality">
                <input {...register("nationality")} className={inputCls} />
              </FormField>
              <FormField label="Employment status">
                <select {...register("employment_status")} className={selectCls}>
                  <option value="">Select…</option>
                  {Object.entries(EMPLOYMENT_STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="Current address">
              <textarea {...register("current_address")} rows={2} className={`${inputCls} h-auto py-2`} />
            </FormField>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" variant="secondary" size="sm" loading={isPending}>Create Tenant</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

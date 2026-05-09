"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ProRataField } from "@/features/contracts/ui/ProRataField";
import {
  contractSchema,
  type ContractFormValues,
} from "@/features/contracts/domain/schemas";
import {
  DEPOSIT_SCHEME_LABELS,
  SIGNING_METHOD_LABELS,
} from "@/features/contracts/domain/types";
import {
  createContract,
  listPropertiesWithUnits,
  uploadContractDocument,
  type PropertyWithUnits,
} from "@/features/contracts/actions/contracts";
import type { PmTenant } from "../domain/types";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const selectCls =
  "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function unitLabel(u: { room_number: string | null; unit_type: string }) {
  if (u.unit_type === "room") return u.room_number ? `Room ${u.room_number}` : "Room";
  if (u.unit_type === "studio") return "Studio";
  return "Whole Flat";
}

interface Props {
  tenant: PmTenant;
  open: boolean;
  onClose: () => void;
  onCreated: (next: PmTenant) => void;
}

export function CreateContractForTenantDialog({
  tenant,
  open,
  onClose,
  onCreated,
}: Props) {
  const [properties, setProperties] = useState<PropertyWithUnits[]>([]);
  const [propertiesLoaded, setPropertiesLoaded] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      pm_tenant_id: tenant.id,
      unit_id: "",
      deposit_scheme: "none",
      deposit_protection_alert: true,
      status: "active",
      pro_rata_amount: null,
      prepaid_first_full_month: false,
    },
  });

  const watchedStart = watch("start_date");
  const watchedRent = watch("rent_pcm");
  const watchedUnitId = watch("unit_id");

  // Load property + unit options when the dialog opens.
  useEffect(() => {
    if (!open || propertiesLoaded) return;
    listPropertiesWithUnits()
      .then((rows) => setProperties(rows))
      .catch(() => toast.error("Failed to load properties"))
      .finally(() => setPropertiesLoaded(true));
  }, [open, propertiesLoaded]);

  // Reset form whenever the dialog reopens for a fresh draft.
  useEffect(() => {
    if (open) {
      reset({
        pm_tenant_id: tenant.id,
        unit_id: "",
        deposit_scheme: "none",
        deposit_protection_alert: true,
        status: "active",
        pro_rata_amount: null,
        prepaid_first_full_month: false,
      });
      setPropertyId("");
      setContractFile(null);
    }
  }, [open, tenant.id, reset]);

  const propertyOptions = useMemo(
    () =>
      properties.map((p) => ({
        value: p.property_id,
        label: p.property_name,
        sublabel: p.address_line_1 ?? undefined,
      })),
    [properties]
  );

  const selectedProperty = properties.find((p) => p.property_id === propertyId);
  const unitOptions = useMemo(() => {
    if (!selectedProperty) return [];
    return selectedProperty.units.map((u) => {
      const label = unitLabel(u);
      const occupied = u.status === "occupied" || !!u.pm_tenant_id;
      return {
        value: u.unit_id,
        label,
        sublabel: occupied ? `${u.status} — new contract will queue` : u.status,
      };
    });
  }, [selectedProperty]);

  const handlePropertyChange = (next: string) => {
    setPropertyId(next);
    // Clear the unit field whenever the property changes.
    setValue("unit_id", "", { shouldValidate: false });
  };

  const onSubmit = (values: ContractFormValues) => {
    startTransition(async () => {
      try {
        const created = (await createContract(values)) as {
          id: string;
          start_date: string;
          expiry_date: string | null;
          rent_pcm: number;
          deposit: number;
          collection_date: number | null;
          pro_rata_amount: number | null;
          prepaid_first_full_month: boolean;
          deposit_scheme: string | null;
          deposit_scheme_ref: string | null;
          deposit_protected_date: string | null;
          signing_method: string | null;
          status: string;
          notice_given_by: string | null;
          notice_given_date: string | null;
          vacate_date: string | null;
          actual_end_date: string | null;
          end_reason: string | null;
          document_url: string | null;
          notes: string | null;
        };

        let documentUrl: string | null = created.document_url;
        if (contractFile) {
          try {
            const formData = new FormData();
            formData.set("contract_id", created.id);
            formData.set("file", contractFile);
            const uploaded = (await uploadContractDocument(formData)) as {
              document_url: string | null;
            };
            documentUrl = uploaded.document_url;
          } catch {
            toast.error("Contract created, but document upload failed");
          }
        }

        toast.success("Contract created");

        const unit = selectedProperty?.units.find((u) => u.unit_id === values.unit_id);
        const property = selectedProperty;
        const next: PmTenant = {
          ...tenant,
          current_contract: {
            id: created.id,
            start_date: created.start_date,
            expiry_date: created.expiry_date,
            rent_pcm: Number(created.rent_pcm),
            deposit: Number(created.deposit),
            collection_date: created.collection_date,
            pro_rata_amount:
              created.pro_rata_amount == null ? null : Number(created.pro_rata_amount),
            prepaid_first_full_month: !!created.prepaid_first_full_month,
            deposit_scheme: created.deposit_scheme,
            deposit_scheme_ref: created.deposit_scheme_ref,
            deposit_protected_date: created.deposit_protected_date,
            signing_method: created.signing_method,
            status: created.status,
            notice_given_by: created.notice_given_by,
            notice_given_date: created.notice_given_date,
            vacate_date: created.vacate_date,
            actual_end_date: created.actual_end_date,
            end_reason: created.end_reason,
            document_url: documentUrl,
            notes: created.notes,
          },
          current_unit:
            unit && property
              ? {
                  id: unit.unit_id,
                  room_number: unit.room_number,
                  unit_type: unit.unit_type,
                  property: {
                    name: property.property_name,
                    address_line_1: property.address_line_1 ?? "",
                  },
                }
              : tenant.current_unit,
        };

        onCreated(next);
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create contract");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Contract — {tenant.full_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <input type="hidden" {...register("pm_tenant_id")} />
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <FormField label="Property *">
                <SearchableSelect
                  value={propertyId}
                  onChange={handlePropertyChange}
                  options={propertyOptions}
                  placeholder={propertiesLoaded ? "Search properties…" : "Loading…"}
                  disabled={!propertiesLoaded}
                />
              </FormField>
            </div>
            <div className="col-span-2">
              <FormField label="Unit *" error={errors.unit_id?.message}>
                <Controller
                  name="unit_id"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      options={unitOptions}
                      placeholder={
                        !propertyId
                          ? "Pick a property first"
                          : unitOptions.length === 0
                          ? "No units on this property"
                          : "Search units…"
                      }
                      error={!!errors.unit_id}
                      disabled={!propertyId || unitOptions.length === 0}
                    />
                  )}
                />
                {watchedUnitId && (() => {
                  const unit = selectedProperty?.units.find((u) => u.unit_id === watchedUnitId);
                  if (!unit) return null;
                  const occupied = unit.status === "occupied" || !!unit.pm_tenant_id;
                  if (!occupied) return null;
                  return (
                    <p className="text-[11px] text-amber-700 mt-1">
                      This unit is currently {unit.status}. The contract will be
                      queued and activate once the existing tenancy closes out.
                    </p>
                  );
                })()}
              </FormField>
            </div>

            <FormField label="Start date *" error={errors.start_date?.message}>
              <input type="date" {...register("start_date")} className={inputCls} />
            </FormField>
            <FormField label="Expiry date" error={errors.expiry_date?.message}>
              <input type="date" {...register("expiry_date")} className={inputCls} />
            </FormField>
            <FormField label="Collection day">
              <input
                type="number"
                min="1"
                max="31"
                {...register("collection_date")}
                className={inputCls}
              />
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
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Signing method">
              <select {...register("signing_method")} className={selectCls}>
                <option value="">Select…</option>
                {Object.entries(SIGNING_METHOD_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="col-span-2">
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
            </div>

            <div className="col-span-2">
              <FormField label="Contract document">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={isPending}
                  className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-inset file:px-3 file:py-1 file:text-xs file:font-medium file:text-foreground file:cursor-pointer disabled:opacity-50"
                  onChange={(e) => setContractFile(e.target.files?.[0] ?? null)}
                />
              </FormField>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={isPending}
            >
              Create Contract
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, type ClientFormValues } from "../domain/schemas";
import { createClient, updateClient } from "../actions/clients";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";

export function ClientForm({
  clientId,
  initialValues,
  onSuccess,
}: {
  clientId?: string;
  initialValues?: Partial<ClientFormValues>;
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const normalizedInitial = {
    full_name: initialValues?.full_name ?? "",
    dob: initialValues?.dob ?? "",
    phone: initialValues?.phone ?? "",
    email: initialValues?.email ?? "",
    nationality: initialValues?.nationality ?? "",
    current_address: initialValues?.current_address ?? "",
    company_or_university_name: initialValues?.company_or_university_name ?? "",
    company_address: initialValues?.company_address ?? "",
    occupation: initialValues?.occupation ?? "",
    status: initialValues?.status ?? "pending",
    assigned_agent_id: initialValues?.assigned_agent_id,
    agency_name: initialValues?.agency_name ?? "",
    contact_number: initialValues?.contact_number ?? "",
    share_code: initialValues?.share_code ?? ""
  };
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      ...normalizedInitial
    }
  });

  const onSubmit = (values: ClientFormValues) => {
    startTransition(async () => {
      try {
        if (clientId) {
          await updateClient(clientId, values);
          toast.success("Client updated successfully");
        } else {
          await createClient(values);
          toast.success("Client created successfully");
          form.reset();
        }
        onSuccess?.();
      } catch (error) {
        toast.error("Failed to save client");
      }
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Personal Information */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-brand">Personal Information</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted">Full name *</label>
            <Input placeholder="Full name" required {...form.register("full_name")} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted">Phone *</label>
            <Input placeholder="Phone" required {...form.register("phone")} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted">Email *</label>
            <Input placeholder="Email" required {...form.register("email")} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted">Date of birth *</label>
            <Input type="date" required {...form.register("dob")} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted">Nationality *</label>
            <Input placeholder="Nationality" required {...form.register("nationality")} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted">Current address *</label>
            <Input placeholder="Current address" required {...form.register("current_address")} />
          </div>
        </div>
      </div>

      {/* Company/University Information */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-brand">Company / University</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted">Company / University name *</label>
            <Input placeholder="Company / University name" required {...form.register("company_or_university_name")} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted">Company / University address *</label>
            <Input placeholder="Company / University address" required {...form.register("company_address")} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted">Occupation *</label>
            <Input placeholder="Occupation" required {...form.register("occupation")} />
          </div>
        </div>
      </div>

      {/* Agency & contact */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-brand">Agency & contact</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted">Agency name</label>
            <Input placeholder="Agency name" {...form.register("agency_name")} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted">Contact number</label>
            <Input placeholder="Contact number" {...form.register("contact_number")} />
          </div>
        </div>
      </div>

      {/* Share code */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-brand">Share code</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground-muted">Share code</label>
            <Input placeholder="Optional, alphanumeric" {...form.register("share_code")} />
          </div>
          {form.formState.errors.share_code && (
            <p className="text-xs text-red-500 md:col-span-2">
              {form.formState.errors.share_code.message}
            </p>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Status</label>
        <Select
          value={form.watch("status")}
          onChange={(value: string) => form.setValue("status", value as ClientFormValues["status"])}
          options={[
            { label: "Pending", value: "pending" },
            { label: "On hold", value: "on_hold" },
            { label: "Solved", value: "solved" },
            { label: "Registered", value: "registered" }
          ]}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="submit" disabled={isPending} loading={isPending}>
          {clientId ? "Update Client" : "Create Client"}
        </Button>
      </div>
    </form>
  );
}

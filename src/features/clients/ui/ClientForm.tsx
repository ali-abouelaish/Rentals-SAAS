"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, type ClientFormValues } from "../domain/schemas";
import { createClient, updateClient } from "../actions/clients";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function ClientForm({
  clientId,
  initialValues
}: {
  clientId?: string;
  initialValues?: Partial<ClientFormValues>;
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
    assigned_agent_id: initialValues?.assigned_agent_id
  };
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      status: "pending",
      ...normalizedInitial
    }
  });

  const onSubmit = (values: ClientFormValues) => {
    startTransition(async () => {
      if (clientId) {
        await updateClient(clientId, values);
      } else {
        await createClient(values);
        form.reset();
      }
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 md:grid-cols-2">
      <Input placeholder="Full name" required {...form.register("full_name")} />
      <Input placeholder="Phone" required {...form.register("phone")} />
      <Input placeholder="Email" required {...form.register("email")} />
      <Input
        type="date"
        placeholder="Date of birth"
        required
        {...form.register("dob")}
      />
      <Input placeholder="Nationality" required {...form.register("nationality")} />
      <Input placeholder="Current address" required {...form.register("current_address")} />
      <Input
        placeholder="Company / University name"
        required
        {...form.register("company_or_university_name")}
      />
      <Input
        placeholder="Company / University address"
        required
        {...form.register("company_address")}
      />
      <Input placeholder="Occupation" required {...form.register("occupation")} />
      <Select
        value={form.watch("status")}
        onChange={(value) => form.setValue("status", value as ClientFormValues["status"])}
        options={[
          { label: "Pending", value: "pending" },
          { label: "On hold", value: "on_hold" },
          { label: "Solved", value: "solved" }
        ]}
      />
      <div className="md:col-span-2">
        <Button type="submit" disabled={isPending}>
          {clientId ? "Update client" : "Create client"}
        </Button>
      </div>
    </form>
  );
}

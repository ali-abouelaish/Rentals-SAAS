"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { rentalCodeSchema, type RentalCodeFormValues } from "../domain/schemas";
import { createRentalCode } from "../actions/rentals";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function RentalCodeForm({
  clientId,
  agents
}: {
  clientId: string;
  agents: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<RentalCodeFormValues>({
    resolver: zodResolver(rentalCodeSchema),
    defaultValues: {
      client_id: clientId,
      payment_method: "cash",
      consultation_fee_amount: 0
    }
  });

  const onSubmit = (values: RentalCodeFormValues) => {
    startTransition(async () => {
      await createRentalCode(values);
      form.reset({
        client_id: clientId,
        payment_method: "cash",
        consultation_fee_amount: 0
      });
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 md:grid-cols-2">
      <Input placeholder="Consultation fee" type="number" {...form.register("consultation_fee_amount")} />
      <Select
        value={form.watch("payment_method")}
        onChange={(value: string) => form.setValue("payment_method", value as RentalCodeFormValues["payment_method"])}
        options={[
          { label: "Cash", value: "cash" },
          { label: "Transfer", value: "transfer" },
          { label: "Card", value: "card" },
        ]}
      />
      <Input placeholder="Property address" {...form.register("property_address")} />
      <Input placeholder="Licensor name" {...form.register("licensor_name")} />
      <div className="md:col-span-2">
        <label className="text-xs text-gray-500">Marketing agent (optional)</label>
        <Input
          list="marketing-agent-list"
          placeholder="Search by name"
          {...form.register("marketing_agent_name")}
        />
        <datalist id="marketing-agent-list">
          {agents.map((agent) => (
            <option key={agent.id} value={agent.name} />
          ))}
        </datalist>
        <p className="text-xs text-gray-400">
          Leave blank if not applicable.
        </p>
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={isPending}>
          Create rental code
        </Button>
      </div>
    </form>
  );
}

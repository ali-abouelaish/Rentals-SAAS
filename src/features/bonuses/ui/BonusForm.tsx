"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { bonusSchema, type BonusFormValues } from "../domain/schemas";
import { submitBonus } from "../actions/bonuses";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function BonusForm() {
  const [isPending, startTransition] = useTransition();
  const form = useForm<BonusFormValues>({
    resolver: zodResolver(bonusSchema),
    defaultValues: {
      payout_mode: "standard",
      amount_owed: 0
    }
  });

  const onSubmit = (values: BonusFormValues) => {
    startTransition(async () => {
      await submitBonus(values);
      form.reset({ payout_mode: "standard", amount_owed: 0 });
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 md:grid-cols-3">
      <Input placeholder="Landlord ID" {...form.register("landlord_id")} />
      <Input placeholder="Amount owed" type="number" {...form.register("amount_owed")} />
      <Select
        value={form.watch("payout_mode")}
        onChange={(value) => form.setValue("payout_mode", value as BonusFormValues["payout_mode"])}
        options={[
          { label: "Standard (50%)", value: "standard" },
          { label: "Full payout", value: "full" }
        ]}
      />
      <div className="md:col-span-3">
        <Button type="submit" disabled={isPending}>
          Submit bonus
        </Button>
      </div>
    </form>
  );
}

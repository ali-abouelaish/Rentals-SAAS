"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Item = {
  description: string;
  quantity: number;
  rate: number;
};

export function InvoiceItemsForm({
  billingProfiles,
  landlords,
  onSubmit
}: {
  billingProfiles: { id: string; name: string }[];
  landlords: { id: string; name: string }[];
  onSubmit: (formData: FormData) => void;
}) {
  const [items, setItems] = useState<Item[]>([
    { description: "", quantity: 1, rate: 0 }
  ]);

  const totals = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.rate),
        0
      ),
    [items]
  );

  const updateItem = (index: number, patch: Partial<Item>) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <form
      action={onSubmit}
      onSubmit={(event) => {
        const hasInvalid = items.some((item) => item.description.trim().length < 2);
        if (hasInvalid) {
          event.preventDefault();
          toast("Add a description for each item.");
        }
      }}
      className="space-y-4 rounded-2xl border border-border-muted bg-surface-card p-6 shadow-card"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs text-foreground-secondary">Billing profile</label>
          <select name="billing_profile_id" className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm">
            {billingProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-foreground-secondary">Landlord</label>
          <select name="landlord_id" className="h-10 w-full rounded-xl border border-border-muted bg-surface-card px-3 text-sm">
            {landlords.map((landlord) => (
              <option key={landlord.id} value={landlord.id}>
                {landlord.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`item-${index}`} className="grid gap-2 md:grid-cols-4">
            <Input
              placeholder="Description"
              value={item.description}
              onChange={(event) => updateItem(index, { description: event.target.value })}
            />
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Quantity"
              value={item.quantity}
              onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
            />
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Rate"
              value={item.rate}
              onChange={(event) => updateItem(index, { rate: Number(event.target.value) })}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => removeItem(index)}
              disabled={items.length === 1}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => setItems((prev) => [...prev, { description: "", quantity: 1, rate: 0 }])}
        >
          Add item
        </Button>
      </div>

      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-secondary">Subtotal</p>
        <p className="text-sm text-navy">£{totals.toFixed(2)}</p>
      </div>
      <Button type="submit">Create invoice</Button>
    </form>
  );
}

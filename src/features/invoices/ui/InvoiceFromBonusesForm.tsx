"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type BonusRow = {
  id: string;
  landlord_id: string;
  amount_owed: number;
  code: string | null;
  landlords?: { name: string | null; billing_address?: string | null } | null;
};

export function InvoiceFromBonusesForm({
  bonuses,
  billingProfiles,
  onSubmit,
  initialSelected,
  lockSelection
}: {
  bonuses: BonusRow[];
  billingProfiles: { id: string; name: string }[];
  onSubmit: (formData: FormData) => void;
  initialSelected?: string[];
  lockSelection?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(() => {
    const raw = initialSelected ?? [];
    if (raw.length === 0) return [];
    const first = bonuses.find((b) => raw.includes(b.id));
    if (!first) return raw;
    return raw.filter((id) => {
      const b = bonuses.find((x) => x.id === id);
      return b && b.landlord_id === first.landlord_id;
    });
  });
  const landlordLock = useMemo(() => {
    const selectedBonus = bonuses.find((bonus) => selected.includes(bonus.id));
    return selectedBonus?.landlord_id ?? null;
  }, [bonuses, selected]);

  const toggle = (id: string) => {
    if (lockSelection) return;
    const bonus = bonuses.find((b) => b.id === id);
    if (!bonus) return;
    if (landlordLock && bonus.landlord_id !== landlordLock) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <form
      action={onSubmit}
      className="space-y-4 rounded-2xl border border-border-muted bg-surface-card p-6 shadow-card"
    >
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
      <p className="text-xs text-foreground-muted">
        Only bonuses from the same landlord can be included in one invoice.
      </p>
      <div className="space-y-2">
        {bonuses.map((bonus) => {
          const disabled = lockSelection
            ? !selected.includes(bonus.id)
            : landlordLock && bonus.landlord_id !== landlordLock;
          return (
            <label
              key={bonus.id}
              className={`flex items-center justify-between rounded-xl border border-border-muted px-3 py-2 text-sm ${
                disabled ? "opacity-50" : ""
              }`}
            >
              <div>
                <p className="text-navy">
                  {bonus.code ?? bonus.id} — {bonus.landlords?.name ?? "Landlord"}
                </p>
                <p className="text-xs text-foreground-secondary">
                  {bonus.landlords?.billing_address ?? "Address not set"}
                </p>
              </div>
              <input
                type="checkbox"
                checked={selected.includes(bonus.id)}
                disabled={Boolean(disabled)}
                onChange={() => toggle(bonus.id)}
              />
            </label>
          );
        })}
      </div>

      <input type="hidden" name="bonus_ids" value={JSON.stringify(selected)} />
      <Button type="submit" disabled={selected.length === 0}>
        Create invoice from bonuses
      </Button>
    </form>
  );
}

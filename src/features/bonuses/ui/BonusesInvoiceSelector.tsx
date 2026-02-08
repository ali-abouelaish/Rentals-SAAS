"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency } from "@/lib/utils/formatters";
import { toast } from "sonner";

type BonusRow = {
  id: string;
  landlord_id: string;
  amount_owed: number;
  status: string;
  code: string | null;
  landlords?: { name: string | null } | null;
};

export function BonusesInvoiceSelector({ bonuses }: { bonuses: BonusRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const selectedLandlord = useMemo(() => {
    const first = bonuses.find((bonus) => selected.includes(bonus.id));
    return first?.landlord_id ?? null;
  }, [bonuses, selected]);

  const toggle = (id: string, landlordId: string) => {
    if (!selectedLandlord || selectedLandlord === landlordId) {
      setSelected((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
      return;
    }
    toast.error("Please select bonuses from the same landlord.");
  };

  const handleCreate = () => {
    if (selected.length === 0) return;
    const ids = JSON.stringify(selected);
    router.push(`/invoices/from-bonuses?bonus_ids=${encodeURIComponent(ids)}`);
  };

  return (
    <div className="space-y-3">
      <DataTable
        columns={["Select", "Bonus", "Landlord", "Amount", "Status"]}
        rows={bonuses.map((bonus) => [
          <input
            key={`${bonus.id}-select`}
            type="checkbox"
            checked={selected.includes(bonus.id)}
            onChange={() => toggle(bonus.id, bonus.landlord_id)}
          />,
          <span key={`${bonus.id}-code`} className="text-sm text-brand">
            {bonus.code ?? bonus.id}
          </span>,
          <span key={`${bonus.id}-landlord`} className="text-sm text-gray-600">
            {bonus.landlords?.name ?? "Landlord"}
          </span>,
          <span key={`${bonus.id}-amount`} className="text-sm text-gray-600">
            {formatCurrency(bonus.amount_owed)}
          </span>,
          <StatusBadge key={`${bonus.id}-status`} status={bonus.status} />
        ])}
      />

      <div className="flex items-center justify-end">
        <Button type="button" variant="secondary" disabled={selected.length === 0} onClick={handleCreate}>
          Create invoice
        </Button>
      </div>
    </div>
  );
}

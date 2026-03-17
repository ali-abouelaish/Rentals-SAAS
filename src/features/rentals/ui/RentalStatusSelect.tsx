"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { updateRentalStatus } from "@/features/rentals/actions/rentals";

const STATUS_OPTIONS = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Paid", value: "paid" },
  { label: "Refunded", value: "refunded" },
];

export function RentalStatusSelect({
  rentalId,
  currentStatus,
}: {
  rentalId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (value: string) => {
    if (value === currentStatus) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("rental_id", rentalId);
        formData.set("status", value);
        await updateRentalStatus(formData);
        toast.success(`Status updated to ${value}.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update status.");
      }
    });
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground-muted">Status</label>
      <Select
        value={currentStatus}
        onChange={handleChange}
        options={STATUS_OPTIONS}
        disabled={isPending}
      />
    </div>
  );
}

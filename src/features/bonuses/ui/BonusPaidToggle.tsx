"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBonusStatus } from "@/features/bonuses/actions/bonuses";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  declined: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export function BonusPaidToggle({
  bonusId,
  status,
  isAdmin,
}: {
  bonusId: string;
  status: string;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const style = STATUS_STYLES[status] ?? "bg-surface-inset text-foreground-muted";

  if (!isAdmin) {
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}>
        {status}
      </span>
    );
  }

  const handleToggle = () => {
    const newStatus = status === "paid" ? "approved" : "paid";
    const fd = new FormData();
    fd.append("bonus_id", bonusId);
    fd.append("status", newStatus);
    startTransition(async () => {
      try {
        await updateBonusStatus(fd);
        router.refresh();
      } catch {
        toast.error("Failed to update bonus status");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className="cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50"
    >
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}>
        {isPending ? "..." : status}
      </span>
    </button>
  );
}

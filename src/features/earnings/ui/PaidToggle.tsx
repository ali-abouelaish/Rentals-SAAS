"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRentalStatus, updateMarketingAgentPaid } from "@/features/rentals/actions/rentals";
import { toast } from "sonner";

export function PaidToggle({
  rentalId,
  status,
  isAdmin,
  role,
  marketingAgentId,
}: {
  rentalId: string;
  status?: string;
  isAdmin: boolean;
  /** When set to "marketing", the toggle flips the marketing agent's paid_at
   *  on the rental_marketing_agents junction row instead of rental_codes.status. */
  role?: "assisted" | "marketing";
  /** Required when role === "marketing": the user_id of the marketing agent
   *  whose junction row should be toggled. */
  marketingAgentId?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isPaid = status === "paid";

  if (!isAdmin) {
    return isPaid ? (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">Paid</span>
    ) : (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Unpaid</span>
    );
  }

  const handleToggle = () => {
    const fd = new FormData();
    fd.append("rental_id", rentalId);
    startTransition(async () => {
      try {
        if (role === "marketing" && marketingAgentId) {
          fd.append("agent_id", marketingAgentId);
          fd.append("paid", isPaid ? "false" : "true");
          await updateMarketingAgentPaid(fd);
        } else {
          fd.append("status", isPaid ? "approved" : "paid");
          await updateRentalStatus(fd);
        }
        router.refresh();
      } catch {
        toast.error("Failed to update status");
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
      {isPaid ? (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
          {isPending ? "..." : "Paid"}
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          {isPending ? "..." : "Unpaid"}
        </span>
      )}
    </button>
  );
}

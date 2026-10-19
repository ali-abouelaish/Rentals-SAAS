"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tooltip } from "@/components/ui/tooltip";
import { setManagerLinePaid } from "../actions/manager-commission";
import type { ManagerLine } from "../domain/types";

const PAID_PILL =
  "inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300";
const UNPAID_PILL =
  "inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
const MUTED_PILL =
  "inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300";

/** Paid / unpaid pill for one manager line. Admins can click to flip it. */
export function ManagerPaidToggle({
  line,
  isAdmin,
}: {
  line: Pick<ManagerLine, "manager_id" | "source_type" | "source_id" | "state" | "paid">;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isPaid = Boolean(line.paid);

  if (!isPaid && line.state === "pending") {
    return (
      <Tooltip content="The deal is still awaiting approval, so the manager's cut can't be paid yet.">
        <span className={MUTED_PILL} tabIndex={0}>
          Awaiting approval
        </span>
      </Tooltip>
    );
  }

  if (!isAdmin) {
    return <span className={isPaid ? PAID_PILL : UNPAID_PILL}>{isPaid ? "Paid" : "Unpaid"}</span>;
  }

  const handleToggle = () => {
    startTransition(async () => {
      const result = await setManagerLinePaid({
        manager_id: line.manager_id,
        source_type: line.source_type,
        source_id: line.source_id,
        paid: !isPaid,
      });
      if (!result.ok) {
        toast.error("Couldn't update payment", { description: result.error });
        return;
      }
      router.refresh();
    });
  };

  return (
    <Tooltip
      content={
        isPaid
          ? "Click to mark unpaid. The amount recorded when it was paid is discarded."
          : "Click to mark paid. Today's amount is recorded, so later edits to the deal won't change it."
      }
    >
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className="cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        <span className={isPaid ? PAID_PILL : UNPAID_PILL}>
          {isPending ? "..." : isPaid ? "Paid" : "Unpaid"}
        </span>
      </button>
    </Tooltip>
  );
}

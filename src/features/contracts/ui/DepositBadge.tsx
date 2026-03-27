import { Shield, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { differenceInDays } from "date-fns";
import type { PropertyContract } from "../domain/types";

export function DepositBadge({ contract }: { contract: PropertyContract }) {
  if (contract.deposit_protected_date) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700">
        <Shield className="h-3 w-3" />
        Protected
      </span>
    );
  }

  const today = new Date();
  const deadline = contract.deposit_protection_deadline
    ? new Date(contract.deposit_protection_deadline)
    : null;

  if (!deadline) {
    return <span className="text-[11px] text-foreground-muted">No scheme</span>;
  }

  const daysLeft = differenceInDays(deadline, today);

  if (daysLeft < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
        <AlertTriangle className="h-3 w-3" />
        Overdue
      </span>
    );
  }

  if (daysLeft <= 7) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
        <Clock className="h-3 w-3" />
        {daysLeft}d left
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground-muted">
      <Clock className="h-3 w-3" />
      {daysLeft}d to protect
    </span>
  );
}

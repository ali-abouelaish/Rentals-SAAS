import { Check, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PmTenant } from "../domain/types";
import { RIGHT_TO_RENT_LABELS } from "../domain/types";

interface RightToRentBadgeProps {
  tenant: PmTenant;
  showLabel?: boolean;
}

export function RightToRentBadge({ tenant, showLabel = false }: RightToRentBadgeProps) {
  const today = new Date().toISOString().slice(0, 10);
  const isExpired = tenant.right_to_rent_expiry && tenant.right_to_rent_expiry < today;
  const isVerified = tenant.right_to_rent_verified;

  const typeLabel = tenant.right_to_rent_type
    ? RIGHT_TO_RENT_LABELS[tenant.right_to_rent_type]
    : "Unknown";

  if (isExpired) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        "bg-red-100 text-red-700"
      )}>
        <AlertTriangle className="h-3 w-3" />
        {showLabel ? typeLabel : "Expired"}
      </span>
    );
  }

  if (isVerified) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        "bg-green-100 text-green-700"
      )}>
        <Check className="h-3 w-3" />
        {showLabel ? typeLabel : "Verified"}
      </span>
    );
  }

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
      "bg-amber-100 text-amber-700"
    )}>
      <Clock className="h-3 w-3" />
      {showLabel ? typeLabel : "Unverified"}
    </span>
  );
}

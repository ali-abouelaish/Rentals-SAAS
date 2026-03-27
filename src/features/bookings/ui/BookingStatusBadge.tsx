import { cn } from "@/lib/utils/cn";
import { BOOKING_STATUS_CONFIG, type BookingStatus } from "../domain/types";

export function BookingStatusBadge({ status, size = "md" }: { status: BookingStatus; size?: "sm" | "md" }) {
  const cfg = BOOKING_STATUS_CONFIG[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full font-medium",
      cfg.bg, cfg.fg,
      size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

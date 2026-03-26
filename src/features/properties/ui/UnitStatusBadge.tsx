import { cn } from "@/lib/utils/cn";
import { STATUS_CONFIG, type UnitStatus } from "../domain/types";

interface UnitStatusBadgeProps {
  status: UnitStatus;
  size?: "sm" | "md";
  className?: string;
}

export function UnitStatusBadge({ status, size = "sm", className }: UnitStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium border border-transparent",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        config.bg,
        config.fg,
        className
      )}
    >
      <span className={cn("rounded-full shrink-0", config.dot, size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2")} />
      {config.label}
    </span>
  );
}

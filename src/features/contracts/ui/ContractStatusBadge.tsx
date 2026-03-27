import { cn } from "@/lib/utils/cn";
import { CONTRACT_STATUS_CONFIG, type ContractStatus } from "../domain/types";

export function ContractStatusBadge({ status, size = "md" }: { status: ContractStatus; size?: "sm" | "md" }) {
  const cfg = CONTRACT_STATUS_CONFIG[status];
  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-medium",
      cfg.bg, cfg.fg,
      size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
    )}>
      {cfg.label}
    </span>
  );
}

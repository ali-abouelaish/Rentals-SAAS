import { cn } from "@/lib/utils/cn";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Pause,
  Send,
  FileText,
  DollarSign,
  type LucideIcon,
} from "lucide-react";

type StatusConfig = {
  className: string;
  icon?: LucideIcon;
  label?: string;
};

const statusConfig: Record<string, StatusConfig> = {
  pending: {
    className: "bg-pending-bg text-pending-fg border-pending-border",
    icon: Clock,
    label: "Pending",
  },
  draft: {
    className: "bg-surface-inset text-foreground-secondary border-border",
    icon: FileText,
    label: "Draft",
  },
  submitted: {
    className: "bg-info-bg text-info-fg border-info-border",
    icon: Send,
    label: "Submitted",
  },
  approved: {
    className: "bg-success-bg text-success-fg border-success-border",
    icon: CheckCircle2,
    label: "Approved",
  },
  sent: {
    className: "bg-pending-bg text-pending-fg border-pending-border",
    icon: Send,
    label: "Sent",
  },
  paid: {
    className: "bg-success-bg text-success-fg border-success-border",
    icon: DollarSign,
    label: "Paid",
  },
  declined: {
    className: "bg-error-bg text-error-fg border-error-border",
    icon: XCircle,
    label: "Declined",
  },
  refunded: {
    className: "bg-warning-bg text-warning-fg border-warning-border",
    icon: AlertCircle,
    label: "Refunded",
  },
  void: {
    className: "bg-surface-inset text-foreground-muted border-border",
    icon: XCircle,
    label: "Void",
  },
  on_hold: {
    className: "bg-warning-bg text-warning-fg border-warning-border",
    icon: Pause,
    label: "On Hold",
  },
  solved: {
    className: "bg-success-bg text-success-fg border-success-border",
    icon: CheckCircle2,
    label: "Solved",
  },
  active: {
    className: "bg-success-bg text-success-fg border-success-border",
    icon: CheckCircle2,
    label: "Active",
  },
  inactive: {
    className: "bg-surface-inset text-foreground-muted border-border",
    label: "Inactive",
  },
};

interface StatusBadgeProps {
  status: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function StatusBadge({ status, showIcon = true, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] ?? {
    className: "bg-surface-inset text-foreground-secondary border-border",
  };
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold",
        sizeClasses[size],
        config.className
      )}
    >
      {showIcon && Icon && (
        <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      )}
      {config.label ?? status.replace("_", " ")}
    </span>
  );
}

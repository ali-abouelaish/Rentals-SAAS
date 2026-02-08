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
  type LucideIcon
} from "lucide-react";

type StatusConfig = {
  className: string;
  icon?: LucideIcon;
  label?: string;
};

const statusConfig: Record<string, StatusConfig> = {
  // Workflow statuses
  pending: {
    className: "bg-slate-100 text-slate-700 border-slate-200",
    icon: Clock,
    label: "Pending"
  },
  draft: {
    className: "bg-slate-100 text-slate-600 border-slate-200",
    icon: FileText,
    label: "Draft"
  },
  submitted: {
    className: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Send,
    label: "Submitted"
  },
  approved: {
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
    label: "Approved"
  },
  sent: {
    className: "bg-indigo-100 text-indigo-700 border-indigo-200",
    icon: Send,
    label: "Sent"
  },
  paid: {
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: DollarSign,
    label: "Paid"
  },
  declined: {
    className: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle,
    label: "Declined"
  },
  refunded: {
    className: "bg-amber-100 text-amber-700 border-amber-200",
    icon: AlertCircle,
    label: "Refunded"
  },
  void: {
    className: "bg-slate-100 text-slate-500 border-slate-200",
    icon: XCircle,
    label: "Void"
  },

  // Client/Lead statuses
  on_hold: {
    className: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Pause,
    label: "On Hold"
  },
  solved: {
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
    label: "Solved"
  },

  // Generic
  active: {
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
    label: "Active"
  },
  inactive: {
    className: "bg-slate-100 text-slate-500 border-slate-200",
    label: "Inactive"
  }
};

interface StatusBadgeProps {
  status: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function StatusBadge({
  status,
  showIcon = true,
  size = "md"
}: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] ?? {
    className: "bg-slate-100 text-slate-600 border-slate-200"
  };
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold",
        sizeClasses[size],
        config.className
      )}
    >
      {showIcon && Icon && <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />}
      {config.label ?? status.replace("_", " ")}
    </span>
  );
}

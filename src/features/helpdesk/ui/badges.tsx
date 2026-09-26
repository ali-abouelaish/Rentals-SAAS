import { cn } from "@/lib/utils/cn";
import {
  PRIORITY_SHORT,
  PRIORITY_TONE,
  STATUS_LABELS,
  STATUS_LABELS_PLATFORM,
  STATUS_TONE,
  type TicketPriority,
  type TicketStatus,
} from "../domain/types";

const PILL = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap";

export function TicketStatusBadge({ status, side = "agency" }: { status: TicketStatus; side?: "agency" | "platform" }) {
  const label = side === "platform" ? STATUS_LABELS_PLATFORM[status] : STATUS_LABELS[status];
  return <span className={cn(PILL, STATUS_TONE[status])}>{label}</span>;
}

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  return <span className={cn(PILL, PRIORITY_TONE[priority])}>{PRIORITY_SHORT[priority]}</span>;
}

export function UnreadDot({ label = "New reply" }: { label?: string }) {
  return (
    <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" aria-label={label} title={label} />
  );
}

export function formatTicketTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

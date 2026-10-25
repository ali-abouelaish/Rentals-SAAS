import { cn } from "@/lib/utils/cn";
import { STATUS_LABELS, STATUS_TONE, type DemoRequestStatus } from "../../domain/types";

const PILL = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap";

export function DemoStatusBadge({ status }: { status: DemoRequestStatus }) {
  return <span className={cn(PILL, STATUS_TONE[status])}>{STATUS_LABELS[status]}</span>;
}

export function QuoteBadge() {
  return <span className={cn(PILL, "bg-indigo-50 text-indigo-800 ring-indigo-200")}>Enterprise quote</span>;
}

export function formatDemoTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

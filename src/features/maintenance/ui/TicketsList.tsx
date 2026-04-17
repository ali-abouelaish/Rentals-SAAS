"use client";

import { useMemo, useState } from "react";
import {
  Search,
  MessageSquareText,
  AlertTriangle,
  ChevronRight,
  Paperclip,
  Home,
  UserRound,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type {
  MaintenanceTicketListItem,
  TicketStatus,
  TicketPriority,
} from "../domain/ticket-types";

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  pending_parts: "Awaiting parts",
  pending_quote: "Awaiting quote",
  resolved: "Resolved",
  closed: "Closed",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<TicketStatus, string> = {
  open: "bg-sky-100 text-sky-700",
  acknowledged: "bg-indigo-100 text-indigo-700",
  in_progress: "bg-blue-100 text-blue-700",
  pending_parts: "bg-amber-100 text-amber-700",
  pending_quote: "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const PRIORITY_DOT: Record<TicketPriority, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-400",
  low: "bg-slate-400",
};

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  critical: "P0",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STATUS_FILTERS: Array<{ label: string; value: TicketStatus | "all" | "unread" }> = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "Open", value: "open" },
  { label: "In progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
];

function daysAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

interface TicketsListProps {
  tickets: MaintenanceTicketListItem[];
  onOpen: (ticket: MaintenanceTicketListItem) => void;
}

export function TicketsList({ tickets, onOpen }: TicketsListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all" | "unread">("all");

  const counts = useMemo(() => {
    const unread = tickets.filter((t) => !t.seen_by_landlord).length;
    const open = tickets.filter((t) => t.status === "open").length;
    const inProgress = tickets.filter((t) => t.status === "in_progress").length;
    const emergencies = tickets.filter(
      (t) => t.emergency_type && !["resolved", "closed", "cancelled"].includes(t.status)
    ).length;
    return { unread, open, inProgress, emergencies };
  }, [tickets]);

  const filtered = useMemo(() => {
    let list = tickets;
    if (statusFilter === "unread") {
      list = list.filter((t) => !t.seen_by_landlord);
    } else if (statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.reference.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.property_name.toLowerCase().includes(q) ||
          t.pm_tenant_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tickets, statusFilter, search]);

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Unread", value: counts.unread, tone: "bg-brand/10 text-brand" },
          { label: "Open", value: counts.open, tone: "bg-sky-100 text-sky-700" },
          { label: "In progress", value: counts.inProgress, tone: "bg-blue-100 text-blue-700" },
          { label: "Emergencies", value: counts.emergencies, tone: "bg-red-100 text-red-700" },
        ].map((c) => (
          <span
            key={c.label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              c.tone
            )}
          >
            {c.value} {c.label}
          </span>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-surface-card text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
        </div>

        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-brand text-brand-fg shadow-sm"
                  : "text-foreground-secondary hover:bg-surface-inset"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="rounded-bento bg-surface-card shadow-bento overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <MessageSquareText
              size={32}
              className="mx-auto text-foreground-muted mb-3"
              strokeWidth={1.5}
            />
            <p className="text-sm text-foreground-secondary">
              {search || statusFilter !== "all"
                ? "No tickets match your filters"
                : "No tenant tickets yet"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {filtered.map((t) => (
              <TicketRow key={t.id} ticket={t} onClick={() => onOpen(t)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TicketRow({
  ticket,
  onClick,
}: {
  ticket: MaintenanceTicketListItem;
  onClick: () => void;
}) {
  const unread = !ticket.seen_by_landlord;
  const isEmergency = !!ticket.emergency_type;
  const firstLine = ticket.description.split("\n")[0];

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors",
          "hover:bg-surface-inset",
          unread && "bg-brand/[0.03]"
        )}
      >
        {/* Unread marker + priority dot */}
        <div className="flex flex-col items-center gap-1.5 pt-1 shrink-0">
          {unread ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
            </span>
          ) : (
            <Circle size={8} className="text-transparent" />
          )}
          <span
            className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[ticket.priority])}
            title={PRIORITY_LABEL[ticket.priority]}
          />
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "font-mono text-[11px] tracking-wider uppercase",
                unread ? "text-brand font-semibold" : "text-foreground-muted"
              )}
            >
              {ticket.reference}
            </span>
            {isEmergency && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                <AlertTriangle size={10} /> Emergency
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                STATUS_TONE[ticket.status]
              )}
            >
              {STATUS_LABELS[ticket.status]}
            </span>
            {ticket.attachment_count > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-foreground-muted">
                <Paperclip size={11} />
                {ticket.attachment_count}
              </span>
            )}
          </div>

          <p
            className={cn(
              "mt-1 text-sm line-clamp-2",
              unread ? "text-foreground font-medium" : "text-foreground-secondary"
            )}
          >
            {firstLine}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-muted">
            <span className="inline-flex items-center gap-1">
              <Home size={11} />
              {ticket.property_name}
              <span className="text-foreground-muted/60">·</span>
              {ticket.unit_label}
            </span>
            <span className="inline-flex items-center gap-1">
              <UserRound size={11} />
              {ticket.pm_tenant_name}
            </span>
          </div>
        </div>

        {/* Age + chevron */}
        <div className="flex flex-col items-end gap-1 shrink-0 pt-1">
          <span className="text-[11px] text-foreground-muted whitespace-nowrap">
            {daysAgo(ticket.created_at)}
          </span>
          <ChevronRight
            size={14}
            className="text-foreground-muted group-hover:text-foreground transition-colors"
          />
        </div>
      </button>
    </li>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Paperclip,
  Phone,
  Mail,
  Home,
  Hash,
  UserRound,
  Clock,
  MessageSquareText,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";
import type {
  MaintenanceTicketDetail,
  MaintenanceTicketListItem,
  TicketStatus,
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
  open: "bg-sky-100 text-sky-700 ring-sky-200",
  acknowledged: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  in_progress: "bg-blue-100 text-blue-700 ring-blue-200",
  pending_parts: "bg-amber-100 text-amber-700 ring-amber-200",
  pending_quote: "bg-amber-100 text-amber-700 ring-amber-200",
  resolved: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  closed: "bg-slate-200 text-slate-700 ring-slate-300",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-200",
};

const STATUS_OPTIONS: TicketStatus[] = [
  "open",
  "acknowledged",
  "in_progress",
  "pending_parts",
  "pending_quote",
  "resolved",
  "closed",
  "cancelled",
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface TicketDrawerProps {
  ticketId: string | null;
  open: boolean;
  onClose: () => void;
  onTicketUpdated: (updated: Partial<MaintenanceTicketListItem> & { id: string }) => void;
}

export function TicketDrawer({
  ticketId,
  open,
  onClose,
  onTicketUpdated,
}: TicketDrawerProps) {
  const [ticket, setTicket] = useState<MaintenanceTicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  // Fetch ticket + mark as seen on open
  useEffect(() => {
    if (!open || !ticketId) {
      setTicket(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/maintenance/tickets/${ticketId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load ticket");
        const data = (await res.json()) as { ticket: MaintenanceTicketDetail };
        if (cancelled) return;
        setTicket(data.ticket);

        // Mark as seen (fire-and-forget)
        if (!data.ticket.seen_by_landlord) {
          fetch(`/api/maintenance/tickets/${ticketId}/seen`, {
            method: "POST",
          })
            .then(() => {
              if (!cancelled) {
                onTicketUpdated({ id: ticketId, seen_by_landlord: true });
              }
            })
            .catch(() => {});
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) toast.error("Couldn't load ticket");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticketId]);

  async function handleStatusChange(next: TicketStatus) {
    if (!ticket || next === ticket.status) return;
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/maintenance/tickets/${ticket.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Status update failed");
      }
      setTicket((prev) => (prev ? { ...prev, status: next } : prev));
      onTicketUpdated({ id: ticket.id, status: next });
      toast.success(`Status → ${STATUS_LABELS[next]}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Status update failed";
      toast.error(msg);
    } finally {
      setStatusSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent side="right" className="p-0 gap-0 w-full sm:max-w-[640px]">
        <SheetHeader className="sr-only">
          <SheetTitle>Ticket details</SheetTitle>
        </SheetHeader>

        {loading && !ticket && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-foreground-muted" />
          </div>
        )}

        {ticket && (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div
              className={cn(
                "relative px-6 pt-6 pb-5 border-b border-border",
                ticket.emergency_type && "bg-red-50"
              )}
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-surface-inset text-foreground-muted hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>

              {ticket.emergency_type && (
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                  <AlertTriangle size={11} /> Emergency · {ticket.emergency_type.replace(/_/g, " ")}
                </div>
              )}

              <div className="flex items-center gap-2 text-[11px] text-foreground-muted mb-1">
                <Hash size={11} />
                <span className="font-mono uppercase tracking-wider">{ticket.reference}</span>
                <span>·</span>
                <Clock size={11} />
                <span>{formatDateTime(ticket.created_at)}</span>
              </div>

              <h2 className="text-lg font-semibold text-foreground leading-snug pr-8">
                {ticket.description.split("\n")[0]}
              </h2>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full ring-1 px-2.5 py-1 text-xs font-semibold",
                    STATUS_TONE[ticket.status]
                  )}
                >
                  {STATUS_LABELS[ticket.status]}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-inset px-2.5 py-1 text-xs font-medium text-foreground-secondary">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      ticket.priority === "critical"
                        ? "bg-red-500"
                        : ticket.priority === "high"
                          ? "bg-orange-500"
                          : ticket.priority === "medium"
                            ? "bg-amber-400"
                            : "bg-slate-400"
                    )}
                  />
                  {ticket.priority === "critical"
                    ? "P0 critical"
                    : ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                </span>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {/* Status action bar */}
              <div className="px-6 py-4 border-b border-border bg-surface-inset/40">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted mb-2">
                  Update status
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((s) => {
                    const active = ticket.status === s;
                    return (
                      <button
                        key={s}
                        disabled={statusSaving || active}
                        onClick={() => handleStatusChange(s)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                          active
                            ? "bg-brand text-brand-fg"
                            : "bg-surface-card text-foreground-secondary border border-border hover:border-brand/40 hover:text-foreground",
                          statusSaving && "opacity-60 cursor-wait"
                        )}
                      >
                        {active && <Check size={11} />}
                        {STATUS_LABELS[s]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              {ticket.description.split("\n").length > 1 && (
                <Section title="Description">
                  <p className="whitespace-pre-wrap text-sm text-foreground-secondary leading-relaxed">
                    {ticket.description}
                  </p>
                </Section>
              )}

              {/* Tenant + location */}
              <Section title="Tenant & location">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoCard
                    icon={<UserRound size={13} />}
                    label="Tenant"
                    primary={ticket.pm_tenant_name}
                    secondary={
                      <div className="space-y-0.5">
                        {ticket.pm_tenant_email && (
                          <a
                            href={`mailto:${ticket.pm_tenant_email}`}
                            className="inline-flex items-center gap-1 text-brand hover:underline"
                          >
                            <Mail size={11} /> {ticket.pm_tenant_email}
                          </a>
                        )}
                        {ticket.pm_tenant_phone && (
                          <a
                            href={`tel:${ticket.pm_tenant_phone}`}
                            className="inline-flex items-center gap-1 text-brand hover:underline"
                          >
                            <Phone size={11} /> {ticket.pm_tenant_phone}
                          </a>
                        )}
                      </div>
                    }
                  />
                  <InfoCard
                    icon={<Home size={13} />}
                    label="Location"
                    primary={ticket.property_name}
                    secondary={ticket.unit_label}
                  />
                </div>
              </Section>

              {/* Attachments */}
              {ticket.attachments.length > 0 && (
                <Section
                  title="Attachments"
                  trailing={
                    <span className="inline-flex items-center gap-1 text-[11px] text-foreground-muted">
                      <Paperclip size={11} /> {ticket.attachments.length}
                    </span>
                  }
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ticket.attachments.map((a) => (
                      <AttachmentTile key={a.id} attachment={a} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Conversation */}
              {ticket.messages.length > 0 && (
                <Section
                  title="Triage conversation"
                  trailing={
                    <span className="inline-flex items-center gap-1 text-[11px] text-foreground-muted">
                      <MessageSquareText size={11} /> {ticket.messages.length}
                    </span>
                  }
                >
                  <div className="space-y-2.5">
                    {ticket.messages.map((m, i) => (
                      <ConversationBubble key={i} message={m} />
                    ))}
                  </div>
                </Section>
              )}

              <div className="h-6" />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="px-6 py-5 border-b border-border last:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
          {title}
        </h3>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function InfoCard({
  icon,
  label,
  primary,
  secondary,
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted inline-flex items-center gap-1 mb-1">
        {icon} {label}
      </p>
      <p className="text-sm font-medium text-foreground">{primary}</p>
      {secondary && <div className="mt-1 text-xs text-foreground-secondary">{secondary}</div>}
    </div>
  );
}

function AttachmentTile({
  attachment,
}: {
  attachment: MaintenanceTicketDetail["attachments"][number];
}) {
  const { kind, signed_url } = attachment;
  if (!signed_url) {
    return (
      <div className="aspect-square rounded-xl border border-border bg-surface-inset flex items-center justify-center text-[11px] text-foreground-muted">
        Unavailable
      </div>
    );
  }

  if (kind === "image") {
    return (
      <a
        href={signed_url}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative aspect-square rounded-xl overflow-hidden border border-border bg-surface-inset"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={signed_url}
          alt=""
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </a>
    );
  }

  if (kind === "video") {
    return (
      <video
        src={signed_url}
        controls
        className="aspect-square w-full rounded-xl border border-border bg-black object-cover"
      />
    );
  }

  return (
    <div className="aspect-square rounded-xl border border-border bg-surface-inset p-3 flex flex-col justify-end">
      <audio src={signed_url} controls className="w-full" />
    </div>
  );
}

function ConversationBubble({
  message,
}: {
  message: MaintenanceTicketDetail["messages"][number];
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-brand text-brand-fg rounded-br-sm"
            : message.role === "system"
              ? "bg-amber-50 text-amber-900 border border-amber-200"
              : "bg-surface-inset text-foreground border border-border rounded-bl-sm"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p
          className={cn(
            "mt-1 text-[10px]",
            isUser ? "text-brand-fg/70" : "text-foreground-muted"
          )}
        >
          {new Date(message.created_at).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

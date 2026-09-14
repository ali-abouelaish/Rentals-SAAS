"use client";

import Link from "next/link";
import { Bell, Mail, MessageSquare, Repeat, ArrowRight, AlarmClock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { InboxMessage } from "@/features/automations/data/queries";

// ──────────────────────────────────────────────────────────
// Vertical reminders rail that sits beside the progress donuts.
// Shows actionable in-app reminders and the soonest upcoming
// scheduled messages, linking through to the full inbox.
// ──────────────────────────────────────────────────────────

const WHEN_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "email") return <Mail className="h-3.5 w-3.5" />;
  if (channel === "sms") return <MessageSquare className="h-3.5 w-3.5" />;
  return <Bell className="h-3.5 w-3.5" />;
}

function statusBadge(row: InboxMessage): { label: string; cls: string } {
  const overdue =
    row.channel === "in_app" &&
    row.status === "sent" &&
    !row.acknowledged_at &&
    new Date(row.send_at).getTime() < Date.now() - 24 * 60 * 60 * 1000;
  if (overdue) return { label: "Overdue", cls: "bg-red-100 text-red-700" };
  if (row.status === "snoozed") return { label: "Snoozed", cls: "bg-amber-100 text-amber-700" };
  if (row.channel === "in_app" && row.status === "sent" && !row.acknowledged_at) {
    return { label: "Pending", cls: "bg-blue-100 text-blue-700" };
  }
  return { label: "Queued", cls: "bg-surface-inset text-foreground-secondary" };
}

export function DashboardReminders({ reminders }: { reminders: InboxMessage[] }) {
  const pendingCount = reminders.filter(
    (r) => r.channel === "in_app" && r.status === "sent" && !r.acknowledged_at
  ).length;

  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="shrink-0 p-2 rounded-lg bg-brand-subtle">
            <AlarmClock className="h-4 w-4 text-brand" strokeWidth={2} />
          </div>
          <h2 className="truncate text-base font-semibold text-foreground">Reminders</h2>
          {pendingCount > 0 && (
            <span className="shrink-0 text-xs font-medium text-foreground-secondary bg-surface-inset px-2 py-0.5 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        <Link
          href="/reminders"
          className="shrink-0 text-[13px] font-medium text-foreground-muted hover:text-brand transition-colors flex items-center gap-1"
        >
          View <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {reminders.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center py-6">
          <p className="text-sm text-foreground-muted">Nothing coming up.</p>
        </div>
      ) : (
        <ul className="flex-1 space-y-2.5">
          {reminders.map((row) => {
            const badge = statusBadge(row);
            return (
              <li
                key={row.id}
                className="rounded-xl border border-border bg-surface-inset/40 p-3"
              >
                <div className="flex min-w-0 items-center gap-2 text-foreground-secondary">
                  <span className="shrink-0">
                    <ChannelIcon channel={row.channel} />
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {row.subject || row.body.slice(0, 80)}
                  </span>
                  {row.recurrence && (
                    <span title="Repeats on a schedule" className="shrink-0">
                      <Repeat className="h-3 w-3 text-foreground-muted" />
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex min-w-0 items-center gap-2 text-[11px] text-foreground-muted">
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-medium", badge.cls)}>
                    {badge.label}
                  </span>
                  <span className="truncate">
                    {row.status === "sent" && row.sent_at
                      ? `Sent ${WHEN_FMT.format(new Date(row.sent_at))}`
                      : `Due ${WHEN_FMT.format(new Date(row.send_at))}`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

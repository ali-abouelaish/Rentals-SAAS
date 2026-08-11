"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlarmClock,
  Bell,
  Check,
  Mail,
  MessageSquare,
  Repeat,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import type { MessageEntityType } from "../domain/types";
import type { InboxMessage, ReminderTab } from "../data/queries";
import {
  acknowledgeMessage,
  cancelMessage,
  dismissMessage,
  snoozeMessage,
} from "../actions/reminders";
import { EditQueuedMessageDialog } from "./EditQueuedMessageDialog";

const TABS: { key: ReminderTab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "queued", label: "Queued" },
  { key: "sent", label: "Sent" },
  { key: "failed", label: "Failed" },
  { key: "dismissed", label: "Dismissed" },
];

const ENTITY_LABEL: Record<MessageEntityType, string> = {
  property: "Property",
  unit: "Unit",
  tenancy: "Tenancy",
  pm_tenant: "Tenant",
  works_order: "Works order",
  owner: "Owner",
  certificate: "Certificate",
};

function entityHref(type: MessageEntityType, id: string): string | null {
  switch (type) {
    case "property":
      return `/properties/${id}`;
    case "pm_tenant":
      return `/tenants/${id}`;
    case "certificate":
      return `/compliance`;
    default:
      return null;
  }
}

const WHEN_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
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
  switch (row.status) {
    case "queued":
      return { label: "Queued", cls: "bg-surface-inset text-foreground-secondary" };
    case "snoozed":
      return { label: "Snoozed", cls: "bg-amber-100 text-amber-700" };
    case "sending":
      return { label: "Sending", cls: "bg-blue-100 text-blue-700" };
    case "sent":
      return row.channel === "in_app" && !row.acknowledged_at
        ? { label: "Pending", cls: "bg-blue-100 text-blue-700" }
        : { label: row.acknowledged_at ? "Done" : "Sent", cls: "bg-emerald-100 text-emerald-700" };
    case "failed":
      return { label: "Failed", cls: "bg-red-100 text-red-700" };
    case "cancelled":
      return { label: "Cancelled", cls: "bg-surface-inset text-foreground-muted" };
    case "dismissed":
      return { label: "Dismissed", cls: "bg-surface-inset text-foreground-muted" };
  }
}

const SNOOZES: { label: string; days: number }[] = [
  { label: "1d", days: 1 },
  { label: "3d", days: 3 },
  { label: "1w", days: 7 },
];

export function RemindersInbox({
  rows,
  tab,
  entityFilter,
}: {
  rows: InboxMessage[];
  tab: ReminderTab;
  entityFilter?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean } & { error?: string }>) => {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok && "error" in res && res.error) {
        toast.error(res.error);
      }
      router.refresh();
    });
  };

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/reminders?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-border overflow-hidden">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setParam("tab", t.key === "pending" ? null : t.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium",
                tab === t.key
                  ? "bg-surface-inset text-foreground"
                  : "text-foreground-secondary hover:text-foreground"
              )}
              title={
                t.key === "pending"
                  ? "In-app reminders waiting for acknowledgement"
                  : t.key === "queued"
                    ? "Messages scheduled but not yet sent"
                    : undefined
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <select
          value={entityFilter ?? ""}
          onChange={(e) => setParam("entity", e.target.value || null)}
          className="rounded-xl border border-border bg-surface-card px-2 py-1.5 text-xs text-foreground"
          title="Only show reminders linked to one kind of record"
        >
          <option value="">All records</option>
          {(Object.keys(ENTITY_LABEL) as MessageEntityType[]).map((k) => (
            <option key={k} value={k}>
              {ENTITY_LABEL[k]}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface-card p-8 text-center text-sm text-foreground-muted">
          {tab === "pending"
            ? "No pending reminders — you're all caught up."
            : "Nothing here yet."}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const badge = statusBadge(row);
            const href =
              row.related_entity_type && row.related_entity_id
                ? entityHref(row.related_entity_type, row.related_entity_id)
                : null;
            return (
              <li
                key={row.id}
                className="rounded-2xl border border-border bg-surface-card p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-foreground-secondary">
                      <ChannelIcon channel={row.channel} />
                      <span className="text-sm font-medium text-foreground truncate">
                        {row.subject || row.body.slice(0, 80)}
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", badge.cls)}>
                        {badge.label}
                      </span>
                      {row.recurrence && (
                        <span title="Repeats on a schedule">
                          <Repeat className="h-3 w-3 text-foreground-muted" />
                        </span>
                      )}
                    </div>
                    {row.subject && (
                      <p className="text-xs text-foreground-secondary mt-1 line-clamp-2">
                        {row.body}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-foreground-muted">
                      <span>
                        {row.status === "sent" && row.sent_at
                          ? `Sent ${WHEN_FMT.format(new Date(row.sent_at))}`
                          : `Due ${WHEN_FMT.format(new Date(row.send_at))}`}
                      </span>
                      {row.assignee_name && <span>· for {row.assignee_name}</span>}
                      {row.sent_to && <span>· to {row.sent_to}</span>}
                      {row.related_entity_type && (
                        <span>
                          ·{" "}
                          {href ? (
                            <Link href={href} className="underline hover:text-foreground">
                              {ENTITY_LABEL[row.related_entity_type]}
                            </Link>
                          ) : (
                            ENTITY_LABEL[row.related_entity_type]
                          )}
                        </span>
                      )}
                      {row.status === "failed" && row.last_error && (
                        <span className="text-red-600">· {row.last_error}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {row.channel === "in_app" &&
                      row.status === "sent" &&
                      !row.acknowledged_at && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isPending}
                            title="Mark this reminder as done"
                            onClick={() => run(() => acknowledgeMessage(row.id))}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Done
                          </Button>
                          {SNOOZES.map((s) => (
                            <Button
                              key={s.label}
                              variant="ghost"
                              size="sm"
                              disabled={isPending}
                              title={`Snooze for ${s.days} day${s.days > 1 ? "s" : ""}`}
                              onClick={() =>
                                run(() =>
                                  snoozeMessage(
                                    row.id,
                                    new Date(
                                      Date.now() + s.days * 24 * 60 * 60 * 1000
                                    ).toISOString()
                                  )
                                )
                              }
                            >
                              <AlarmClock className="h-3 w-3" />
                              {s.label}
                            </Button>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            className="text-red-600 hover:text-red-700"
                            title="Remove this reminder without marking it done"
                            onClick={() => run(() => dismissMessage(row.id))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}

                    {(row.status === "queued" || row.status === "snoozed") && (
                      <>
                        <EditQueuedMessageDialog row={row} />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          className="text-red-600 hover:text-red-700"
                          title="Cancel this message before it sends"
                          onClick={() => run(() => cancelMessage(row.id))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

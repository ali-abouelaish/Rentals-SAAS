import Link from "next/link";
import { AlertTriangle, ChevronRight, LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilterActions, FilterBar, FilterGroup, FilterRow } from "@/components/ui/filter-bar";
import { listAllTickets } from "@/features/helpdesk/data/admin";
import {
  CATEGORY_LABELS,
  PRIORITY_SHORT,
  STATUS_LABELS_PLATFORM,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "@/features/helpdesk/domain/types";
import {
  TicketPriorityBadge,
  TicketStatusBadge,
  UnreadDot,
  formatTicketTime,
} from "@/features/helpdesk/ui/badges";

export const dynamic = "force-dynamic";

const SELECT_CLASS =
  "flex h-11 md:h-10 rounded-lg border bg-surface-card px-3 py-2 text-base sm:text-sm border-border text-foreground-secondary w-full sm:w-auto sm:min-w-[180px]";

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams?: { status?: string; priority?: string; tenantId?: string };
}) {
  const status = searchParams?.status ?? "active";
  const priority = searchParams?.priority ?? "all";
  const tenantId = searchParams?.tenantId ?? "all";

  const queue = await listAllTickets({ status, priority, tenantId });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Support Tickets"
        subtitle="Tickets raised by agencies from Contact Support. Replies are emailed to the user who raised them; internal notes never are."
      />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active", value: queue.counts.active },
          { label: "Unread", value: queue.counts.unread },
          { label: "Urgent", value: queue.counts.urgent },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-foreground-muted">{stat.label}</p>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <FilterBar>
        <form method="get">
          <FilterRow>
            <FilterGroup label="Status">
              <select name="status" defaultValue={status} className={SELECT_CLASS}>
                <option value="active">Active (open, in progress, waiting)</option>
                <option value="all">All statuses</option>
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS_PLATFORM[s]}
                  </option>
                ))}
              </select>
            </FilterGroup>
            <FilterGroup label="Priority">
              <select name="priority" defaultValue={priority} className={SELECT_CLASS}>
                <option value="all">Any priority</option>
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_SHORT[p]}
                  </option>
                ))}
              </select>
            </FilterGroup>
            <FilterGroup label="Agency">
              <select name="tenantId" defaultValue={tenantId} className={SELECT_CLASS}>
                <option value="all">All agencies</option>
                {queue.agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </FilterGroup>
            <FilterActions>
              <Button type="submit" variant="outline" size="sm">
                Apply
              </Button>
            </FilterActions>
          </FilterRow>
        </form>
      </FilterBar>

      {queue.unavailable ? (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <div className="text-sm">
                <p className="font-medium text-foreground">Support tickets could not be read</p>
                <p className="text-foreground-secondary mt-1">
                  Apply migration <code>20260926000001_platform_support_tickets.sql</code>, then reload.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : queue.tickets.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card px-4 py-16 text-center">
          <LifeBuoy className="mx-auto mb-3 h-8 w-8 text-foreground-muted" />
          <p className="text-sm font-semibold text-foreground">No tickets match these filters</p>
          <p className="text-xs text-foreground-secondary mt-1">Inbox zero. Nice.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-card">
          {queue.tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/support/${t.id}`} className="flex min-h-11 items-center gap-3 px-4 py-3 hover:bg-surface-inset">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {t.unread && <UnreadDot label="New activity from the agency" />}
                    <span className="text-xs font-mono text-foreground-muted">{t.reference}</span>
                    <TicketStatusBadge status={t.status} side="platform" />
                    <TicketPriorityBadge priority={t.priority} />
                    <span className="text-xs font-medium text-foreground-secondary">{t.tenant_name}</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">{t.subject}</p>
                  <p className="text-[11px] text-foreground-muted">
                    {CATEGORY_LABELS[t.category]} · {t.created_by_name} · Last activity {formatTicketTime(t.last_message_at)}
                  </p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-foreground-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

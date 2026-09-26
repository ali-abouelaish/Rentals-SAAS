import Link from "next/link";
import { ChevronRight, LifeBuoy } from "lucide-react";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import { PageHeader } from "@/components/layout/PageHeader";
import { listMyTickets } from "@/features/helpdesk/data/tickets";
import { CATEGORY_LABELS } from "@/features/helpdesk/domain/types";
import { NewTicketDialog } from "@/features/helpdesk/ui/NewTicketDialog";
import {
  TicketPriorityBadge,
  TicketStatusBadge,
  UnreadDot,
  formatTicketTime,
} from "@/features/helpdesk/ui/badges";

export const dynamic = "force-dynamic";

// Any agency user — deliberately no requireRole and no requireModuleAccess
// (Rental Agency-only agencies must be able to reach us too).
export default async function HelpdeskRoute() {
  await requireUserProfile();
  await requireFeature("support_tickets");

  const header = (
    <PageHeader
      title="Contact Support"
      subtitle="Raise a ticket with the Harbor Ops team and follow our replies here. Only you can see the tickets you raise."
      action={<NewTicketDialog />}
    />
  );

  let tickets;
  try {
    tickets = await listMyTickets();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return (
      <div className="space-y-5">
        {header}
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <LifeBuoy className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">Couldn't load your tickets</p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      {tickets.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card px-4 py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <LifeBuoy className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">No tickets yet</p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto mb-5 leading-relaxed">
            Found a bug, have a billing question or need a hand with something? Raise a ticket and we'll reply by email
            and here.
          </p>
          <NewTicketDialog triggerLabel="Raise your first ticket" />
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-card">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/helpdesk/${t.id}`}
                className="flex min-h-11 items-center gap-3 px-4 py-3 hover:bg-surface-inset"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {t.unread && <UnreadDot label="New reply from Harbor Ops" />}
                    <span className="text-xs font-mono text-foreground-muted">{t.reference}</span>
                    <TicketStatusBadge status={t.status} />
                    <TicketPriorityBadge priority={t.priority} />
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">{t.subject}</p>
                  <p className="text-[11px] text-foreground-muted">
                    {CATEGORY_LABELS[t.category]} · Last activity {formatTicketTime(t.last_message_at)}
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

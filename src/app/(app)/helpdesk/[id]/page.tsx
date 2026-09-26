import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import { getTicketForAgency } from "@/features/helpdesk/data/tickets";
import { CATEGORY_LABELS } from "@/features/helpdesk/domain/types";
import { ReplyComposer } from "@/features/helpdesk/ui/ReplyComposer";
import { TicketConversation } from "@/features/helpdesk/ui/TicketConversation";
import { TicketPriorityBadge, TicketStatusBadge, formatTicketTime } from "@/features/helpdesk/ui/badges";

export const dynamic = "force-dynamic";

export default async function HelpdeskTicketRoute({ params }: { params: { id: string } }) {
  await requireUserProfile();
  await requireFeature("support_tickets");

  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  let ticket;
  try {
    ticket = await getTicketForAgency(params.id);
  } catch (err) {
    return (
      <div className="space-y-4">
        <Link href="/helpdesk" className="inline-flex min-h-11 items-center gap-1 text-sm text-foreground-secondary hover:text-foreground">
          <ArrowLeft size={14} /> All tickets
        </Link>
        <div className="rounded-xl border border-border bg-surface-card p-6 text-sm text-red-600">
          Couldn't load this ticket: {err instanceof Error ? err.message : "Unknown error"}
        </div>
      </div>
    );
  }
  if (!ticket) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/helpdesk" className="inline-flex min-h-11 items-center gap-1 text-sm text-foreground-secondary hover:text-foreground">
        <ArrowLeft size={14} /> All tickets
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-foreground-muted">{ticket.reference}</span>
          <TicketStatusBadge status={ticket.status} />
          <TicketPriorityBadge priority={ticket.priority} />
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-2xl">
          {ticket.subject}
        </h1>
        <p className="mt-1 text-xs text-foreground-muted">
          {CATEGORY_LABELS[ticket.category]} · Raised {formatTicketTime(ticket.created_at)}
        </p>
      </div>

      {ticket.status === "waiting_on_agency" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          We're waiting on a reply from you. Answering below re-opens the ticket.
        </div>
      )}

      <TicketConversation
        viewer="agency"
        openingAuthor={ticket.created_by_name}
        openingBody={ticket.body}
        openingAt={ticket.created_at}
        messages={ticket.messages}
        attachments={ticket.attachments}
      />

      {ticket.status === "closed" ? (
        <div className="rounded-xl border border-border bg-surface-inset px-4 py-3 text-sm text-foreground-secondary">
          This ticket is closed. If you still need help,{" "}
          <Link href="/helpdesk" className="text-foreground-link underline">
            raise a new ticket
          </Link>
          .
        </div>
      ) : (
        <ReplyComposer ticketId={ticket.id} side="agency" />
      )}
    </div>
  );
}

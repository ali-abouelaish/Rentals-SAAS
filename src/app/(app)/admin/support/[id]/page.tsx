import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getTicketForPlatform } from "@/features/helpdesk/data/admin";
import { CATEGORY_LABELS } from "@/features/helpdesk/domain/types";
import { AdminStatusControl } from "@/features/helpdesk/ui/AdminStatusControl";
import { ReplyComposer } from "@/features/helpdesk/ui/ReplyComposer";
import { TicketConversation } from "@/features/helpdesk/ui/TicketConversation";
import { TicketPriorityBadge, TicketStatusBadge, formatTicketTime } from "@/features/helpdesk/ui/badges";

export const dynamic = "force-dynamic";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-foreground-muted">{label}</dt>
      <dd className="text-sm text-foreground [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

export default async function AdminSupportTicketPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const ticket = await getTicketForPlatform(params.id);
  if (!ticket) notFound();

  return (
    <div className="space-y-5">
      <Link href="/admin/support" className="inline-flex min-h-11 items-center gap-1 text-sm text-foreground-secondary hover:text-foreground">
        <ArrowLeft size={14} /> Support queue
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-foreground-muted">{ticket.reference}</span>
          <TicketStatusBadge status={ticket.status} side="platform" />
          <TicketPriorityBadge priority={ticket.priority} />
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-2xl">
          {ticket.subject}
        </h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-5">
          <TicketConversation
            viewer="platform"
            openingAuthor={`${ticket.created_by_name} (${ticket.tenant_name})`}
            openingBody={ticket.body}
            openingAt={ticket.created_at}
            messages={ticket.messages}
            attachments={ticket.attachments}
          />
          <ReplyComposer ticketId={ticket.id} side="platform" currentStatus={ticket.status} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5">
              <AdminStatusControl ticketId={ticket.id} status={ticket.status} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <dl className="space-y-3">
                <Detail
                  label="Agency"
                  value={
                    <Link href={`/admin/tenants/${ticket.tenant_id}`} className="text-foreground-link hover:underline">
                      {ticket.tenant_name}
                    </Link>
                  }
                />
                <Detail
                  label="Raised by"
                  value={
                    <>
                      {ticket.created_by_name}
                      <br />
                      <a href={`mailto:${ticket.created_by_email}`} className="text-foreground-link hover:underline">
                        {ticket.created_by_email}
                      </a>
                    </>
                  }
                />
                <Detail label="Category" value={CATEGORY_LABELS[ticket.category]} />
                <Detail label="Raised" value={formatTicketTime(ticket.created_at)} />
                {ticket.resolved_at && <Detail label="Resolved" value={formatTicketTime(ticket.resolved_at)} />}
                <Detail label="Came from" value={ticket.page_url ?? "— (opened Contact Support directly)"} />
                <Detail label="Browser" value={<span className="text-xs">{ticket.user_agent ?? "—"}</span>} />
                <Detail label="App version" value={ticket.app_version ?? "—"} />
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

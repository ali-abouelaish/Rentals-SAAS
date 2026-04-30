import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getInboxRequest } from "@/features/inbox/data/queries";
import {
  REQUEST_TYPE_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
} from "@/features/inbox/domain/types";
import {
  approveEmailChange,
  completeRequest,
  rejectRequest,
} from "@/features/inbox/actions/resolve";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type Params = { id: string };

export default async function InboxDetailPage({ params }: { params: Params }) {
  await requireRole([...ADMIN_ROLES]);
  const request = await getInboxRequest(params.id);
  if (!request) notFound();

  const payload = request.payload ?? {};
  const isPending = request.status === "pending";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <PageHeader
          title={REQUEST_TYPE_LABELS[request.request_type]}
          subtitle={`From ${request.pm_tenant?.full_name ?? "Unknown"} · ${DATE_FMT.format(new Date(request.created_at))}`}
        />
        <Link href="/inbox" className="text-xs font-semibold text-foreground-secondary hover:text-foreground">
          Back to inbox
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[request.status]}`}>
          {STATUS_LABELS[request.status]}
        </span>
        {request.resolved_at && (
          <span className="text-xs text-foreground-muted">
            Resolved {DATE_FMT.format(new Date(request.resolved_at))}
          </span>
        )}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <DetailRow label="Tenant" value={request.pm_tenant?.full_name ?? "Unknown"} />
          <DetailRow label="Tenant email" value={request.pm_tenant?.email ?? ""} />
          <DetailRow label="Request type" value={REQUEST_TYPE_LABELS[request.request_type]} />
          {request.request_type === "email_change" && (
            <>
              <DetailRow label="Current email" value={String(payload.current_email ?? "")} />
              <DetailRow label="Requested email" value={String(payload.requested_email ?? "")} />
            </>
          )}
          {request.request_type === "alternative_format" && (
            <>
              <DetailRow label="Format" value={String(payload.format ?? "")} />
              <DetailRow label="Notes" value={String(payload.notes ?? "") || "(none)"} />
            </>
          )}
          {(request.request_type === "data_access" || request.request_type === "other") && (
            <DetailRow label="Notes" value={String(payload.notes ?? "") || "(none)"} multiline />
          )}
          {request.resolution_notes && (
            <DetailRow label="Resolution" value={request.resolution_notes} multiline />
          )}
        </CardContent>
      </Card>

      {isPending && request.request_type === "email_change" && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Approve & update email</h2>
            <p className="text-xs text-foreground-secondary leading-relaxed">
              Updates {request.pm_tenant?.full_name ?? "the tenant"}'s email to{" "}
              <strong>{String(payload.requested_email ?? "")}</strong> and resets their email status to active.
              Future reminders will go to the new address.
            </p>
            <form action={approveEmailChange}>
              <input type="hidden" name="id" value={request.id} />
              <Button type="submit" variant="secondary">Approve & update email</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isPending && request.request_type !== "email_change" && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Mark as completed</h2>
            <form action={completeRequest} className="space-y-3">
              <input type="hidden" name="id" value={request.id} />
              <div>
                <label htmlFor="resolution_notes_complete" className="block text-xs font-medium text-foreground-muted mb-1.5">
                  Resolution notes
                </label>
                <textarea
                  id="resolution_notes_complete"
                  name="resolution_notes"
                  rows={3}
                  placeholder="What was done? (optional, kept for audit)"
                  className="flex w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-border-ring/20"
                />
              </div>
              <Button type="submit" variant="secondary">Mark as completed</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isPending && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Decline request</h2>
            <form action={rejectRequest} className="space-y-3">
              <input type="hidden" name="id" value={request.id} />
              <div>
                <label htmlFor="resolution_notes_reject" className="block text-xs font-medium text-foreground-muted mb-1.5">
                  Reason
                </label>
                <textarea
                  id="resolution_notes_reject"
                  name="resolution_notes"
                  rows={3}
                  placeholder="Brief reason. Stored for audit only — not sent to the tenant."
                  className="flex w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-border-ring/20"
                />
              </div>
              <Button type="submit" variant="destructive">Decline</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetailRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-4">
      <div className="text-xs font-medium text-foreground-muted">{label}</div>
      <div
        className={
          multiline
            ? "text-sm text-foreground whitespace-pre-wrap"
            : "text-sm text-foreground"
        }
      >
        {value || "—"}
      </div>
    </div>
  );
}

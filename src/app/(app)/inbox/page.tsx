import Link from "next/link";
import { Inbox as InboxIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { listInboxRequests } from "@/features/inbox/data/queries";
import {
  REQUEST_TYPE_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
  type InboxRequestStatus,
} from "@/features/inbox/domain/types";

const FILTERS: { value: InboxRequestStatus | "all"; label: string }[] = [
  { value: "pending",   label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "rejected",  label: "Declined" },
  { value: "all",       label: "All" },
];

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type SearchParams = { status?: string };

function parseStatus(input: string | undefined): InboxRequestStatus | "all" {
  const allowed = ["pending", "approved", "completed", "rejected", "all"] as const;
  return (allowed as readonly string[]).includes(input ?? "")
    ? (input as InboxRequestStatus | "all")
    : "pending";
}

export default async function InboxPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole([...ADMIN_ROLES]);
  const status = parseStatus(searchParams.status);
  const requests = await listInboxRequests({ status });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        subtitle="Tenant communication requests for your agency. New types of work will surface here over time."
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.value === status;
          return (
            <Link
              key={f.value}
              href={`/inbox?status=${f.value}`}
              className={
                active
                  ? "inline-flex items-center rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-fg"
                  : "inline-flex items-center rounded-full border border-border bg-surface-card px-3 py-1 text-xs font-semibold text-foreground-secondary hover:border-border-strong hover:text-foreground"
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card py-16 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 mb-4">
            <InboxIcon className="h-7 w-7 text-brand" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">No requests in this view</p>
          <p className="text-xs text-foreground-secondary max-w-sm mx-auto leading-relaxed">
            When tenants submit requests through their preferences page, they'll show up here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-card">
          <table className="w-full text-sm">
            <thead className="bg-surface-inset text-xs uppercase tracking-wide text-foreground-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Tenant</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Submitted</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-surface-inset/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{r.pm_tenant?.full_name ?? "Unknown"}</div>
                    <div className="text-xs text-foreground-muted">{r.pm_tenant?.email ?? ""}</div>
                  </td>
                  <td className="px-4 py-3 text-foreground">{REQUEST_TYPE_LABELS[r.request_type]}</td>
                  <td className="px-4 py-3 text-foreground-secondary text-xs">
                    {DATE_FMT.format(new Date(r.created_at))}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/inbox/${r.id}`}
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

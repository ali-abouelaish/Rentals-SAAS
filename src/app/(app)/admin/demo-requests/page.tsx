import Link from "next/link";
import { AlertTriangle, ChevronRight, Inbox } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilterActions, FilterBar, FilterGroup, FilterRow } from "@/components/ui/filter-bar";
import { listDemoRequests } from "@/features/demo-requests/data/admin";
import { portfolioLabel } from "@/features/demo-requests/domain/schemas";
import { DEMO_REQUEST_STATUSES, STATUS_LABELS } from "@/features/demo-requests/domain/types";
import { DemoStatusBadge, QuoteBadge, formatDemoTime } from "@/features/demo-requests/ui/admin/badges";

export const dynamic = "force-dynamic";

const SELECT_CLASS =
  "flex h-11 md:h-10 rounded-lg border bg-surface-card px-3 py-2 text-base sm:text-sm border-border text-foreground-secondary w-full sm:w-auto sm:min-w-[220px]";

export default async function AdminDemoRequestsPage({ searchParams }: { searchParams?: { status?: string } }) {
  const status = searchParams?.status ?? "open";
  const queue = await listDemoRequests({ status });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Demo Requests"
        subtitle="From the website's Request a demo page and the Enterprise card's Request a quote. Each one is emailed to the team inbox, and the requester gets a confirmation promising a reply within 48 hours."
      />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "New", value: queue.counts.new },
          { label: "Last 7 days", value: queue.counts.lastWeek },
          { label: "All time", value: queue.counts.total },
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
                <option value="open">Open (new, contacted, demo booked)</option>
                <option value="all">All statuses</option>
                {DEMO_REQUEST_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
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
                <p className="font-medium text-foreground">Demo requests could not be read</p>
                <p className="text-foreground-secondary mt-1">
                  Apply migration <code>20261025000001_demo_requests.sql</code>, then reload. Until then, requests still
                  reach the team inbox by email.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : queue.requests.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-card px-4 py-16 text-center">
          <Inbox className="mx-auto mb-3 h-8 w-8 text-foreground-muted" />
          <p className="text-sm font-semibold text-foreground">No demo requests match this filter</p>
          <p className="text-xs text-foreground-secondary mt-1">New ones arrive from the website&apos;s Request a demo page.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-card">
          {queue.requests.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/demo-requests/${r.id}`} className="flex min-h-11 items-center gap-3 px-4 py-3 hover:bg-surface-inset">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <DemoStatusBadge status={r.status} />
                    {r.plan_interest === "enterprise" && <QuoteBadge />}
                    <span className="text-xs font-medium text-foreground-secondary">{portfolioLabel(r.portfolio_size)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">
                    {r.company} · {r.first_name} {r.last_name}
                  </p>
                  <p className="text-[11px] text-foreground-muted">
                    {r.email} · {formatDemoTime(r.created_at)}
                    {!r.team_notified_at && " · team email not sent"}
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

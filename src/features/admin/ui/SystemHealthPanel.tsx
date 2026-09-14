import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, MinusCircle, XCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import type { FailureEvent, JobHealth, SystemHealth } from "../data/health";

/**
 * Job health and the merged failure feed.
 *
 * A server component: everything here is read-only, and the window filter is a
 * plain GET form on the page, so there is nothing to hydrate.
 */

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function exactTime(iso: string | null): string {
  if (!iso) return "No run recorded";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function duration(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function JobStatusIcon({ job }: { job: JobHealth }) {
  if (job.unknown) {
    return (
      <Tooltip content="No run history — the platform_job_runs migration may not be applied yet, or this process has only just started.">
        <MinusCircle className="h-4 w-4 text-foreground-muted" aria-label="Unknown" />
      </Tooltip>
    );
  }
  if (job.isStale) {
    return (
      <Tooltip
        content={`No successful run in the last ${job.staleAfterHours} hours. A job that has stopped firing raises no error anywhere, so silence is the only symptom.`}
      >
        <Clock className="h-4 w-4 text-amber-600" aria-label="Stale" />
      </Tooltip>
    );
  }
  if (job.lastStatus === "failed") {
    return (
      <Tooltip content={job.lastError ?? "Last run failed."}>
        <XCircle className="h-4 w-4 text-red-600" aria-label="Failed" />
      </Tooltip>
    );
  }
  if (job.lastStatus === "running") {
    return (
      <Tooltip content="Started and has not reported finishing. If it stays here, the process died mid-run.">
        <Clock className="h-4 w-4 text-brand" aria-label="Running" />
      </Tooltip>
    );
  }
  return (
    <Tooltip content="Last run completed successfully.">
      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="OK" />
    </Tooltip>
  );
}

const SOURCE_STYLE: Record<FailureEvent["source"], string> = {
  job: "bg-red-100 text-red-800",
  email: "bg-amber-100 text-amber-800",
  deposit_api: "bg-blue-100 text-blue-800",
  webhook: "bg-purple-100 text-purple-800",
  error_event: "bg-neutral-200 text-neutral-700"
};

export function SystemHealthPanel({ health }: { health: SystemHealth }) {
  return (
    <div className="space-y-5">
      {health.unavailable.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  Some sources could not be read
                </p>
                <p className="text-foreground-secondary mt-1">
                  {health.unavailable.join(", ")} — most likely a migration that has not
                  been applied yet. Anything those tables would have reported is missing
                  from this page, so treat it as incomplete rather than clear.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Recurring jobs</h2>
            <p className="text-xs text-foreground-muted">
              {health.jobs.length} registered · Europe/London
            </p>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Job</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Issues ({health.windowHours}h)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {health.jobs.map((job) => (
                  <TableRow key={job.name}>
                    <TableCell>
                      <JobStatusIcon job={job} />
                    </TableCell>
                    <TableCell>
                      <Tooltip content={job.description}>
                        <span className="text-sm font-medium text-foreground cursor-help">
                          {job.label}
                        </span>
                      </Tooltip>
                      <span className="block text-[11px] text-foreground-muted">
                        {job.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <code className="text-[11px] text-foreground-secondary">
                        {job.cron}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Tooltip content={exactTime(job.lastRunAt)}>
                        <span
                          className={cn(
                            "text-xs cursor-help",
                            job.isStale ? "text-amber-700 font-medium" : "text-foreground-secondary"
                          )}
                        >
                          {relativeTime(job.lastRunAt)}
                          {job.lastTrigger === "manual" && " (manual)"}
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-xs text-foreground-secondary">
                      {duration(job.lastDurationMs)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {job.failureCount === 0 && job.skippedCount === 0 ? (
                        <span className="text-foreground-muted">—</span>
                      ) : (
                        <span className="space-x-2">
                          {job.failureCount > 0 && (
                            <span className="text-red-600 font-medium">
                              {job.failureCount} failed
                            </span>
                          )}
                          {job.skippedCount > 0 && (
                            <Tooltip content="A run was skipped because the previous one was still going. Repeated skips mean the job is overrunning its own interval.">
                              <span className="text-amber-700 cursor-help">
                                {job.skippedCount} skipped
                              </span>
                            </Tooltip>
                          )}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {health.brokenMailboxes.length > 0 && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              Agency mailboxes needing attention
            </h2>
            <p className="text-xs text-foreground-secondary">
              These agencies send through their own mailbox and that connection is not
              working. Sends fall back to the Harbor Ops mailer, so email still goes out —
              but from the wrong address.
            </p>
            <div className="space-y-2">
              {health.brokenMailboxes.map((mailbox) => (
                <Link
                  key={mailbox.tenantId}
                  href={`/admin/tenants/${mailbox.tenantId}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 hover:bg-surface-inset transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {mailbox.tenantName ?? mailbox.tenantId}
                    </p>
                    <p className="text-[11px] text-foreground-muted">
                      {mailbox.providerType} · {mailbox.status}
                      {mailbox.lastError ? ` · ${mailbox.lastError}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              Failures, last {health.windowHours}h
            </h2>
            <p className="text-xs text-foreground-muted">{health.failures.length} shown</p>
          </div>

          {health.failures.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-600 mb-2" aria-hidden />
              <p className="text-sm text-foreground-secondary">
                Nothing failed in this window.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Agency</TableHead>
                    <TableHead>What happened</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {health.failures.map((failure) => (
                    <TableRow key={failure.id}>
                      <TableCell>
                        <Tooltip content={exactTime(failure.occurredAt)}>
                          <span className="text-xs text-foreground-secondary cursor-help whitespace-nowrap">
                            {relativeTime(failure.occurredAt)}
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
                            SOURCE_STYLE[failure.source]
                          )}
                        >
                          {failure.sourceLabel}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-foreground-secondary">
                        {failure.tenantName ?? (failure.tenantId ? failure.tenantId : "—")}
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-foreground">{failure.summary}</p>
                        {failure.detail && (
                          <p className="text-[11px] text-foreground-muted mt-0.5">
                            {failure.detail}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

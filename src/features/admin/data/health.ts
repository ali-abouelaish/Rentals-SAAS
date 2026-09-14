import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/requireRole";
import { JOB_METADATA, type JobMetadata } from "@/lib/cron/jobCatalogue";

/**
 * System health for the super-admin console.
 *
 * Almost nothing here needs new instrumentation: every failure an operator would
 * want to see is already being written down somewhere and then never looked at.
 * `email_log` records failed sends, the three deposit schemes each keep an API
 * log, BoldSign stores webhook processing errors, and `error_events` is a
 * general sink. This module is the read side that was missing.
 *
 * The one genuinely new source is `platform_job_runs`, because cron outcomes
 * previously went to stdout only.
 */

export type JobHealth = JobMetadata & {
  lastRunAt: string | null;
  lastStatus: "running" | "ok" | "failed" | "skipped" | null;
  lastDurationMs: number | null;
  lastError: string | null;
  lastTrigger: "schedule" | "manual" | null;
  /** Failures in the reporting window. */
  failureCount: number;
  skippedCount: number;
  /**
   * No successful run within `staleAfterHours`.
   *
   * The failure mode worth catching: a job that has stopped firing produces no
   * error anywhere, so silence is the only symptom.
   */
  isStale: boolean;
  /** True when the table is missing — migration not yet applied. */
  unknown: boolean;
};

export type FailureSource =
  | "email"
  | "deposit_api"
  | "webhook"
  | "error_event"
  | "job";

export type FailureEvent = {
  id: string;
  source: FailureSource;
  /** Short label for the source column. */
  sourceLabel: string;
  occurredAt: string;
  tenantId: string | null;
  tenantName: string | null;
  summary: string;
  detail: string | null;
};

export type MailboxHealth = {
  tenantId: string;
  tenantName: string | null;
  providerType: string;
  status: string;
  lastError: string | null;
  verifiedAt: string | null;
};

export type SystemHealth = {
  windowHours: number;
  jobs: JobHealth[];
  failures: FailureEvent[];
  /** Agencies whose own mailbox connection is not working. */
  brokenMailboxes: MailboxHealth[];
  counts: {
    jobFailures: number;
    emailFailures: number;
    integrationErrors: number;
    staleJobs: number;
  };
  /**
   * Tables that could not be read, by name.
   *
   * Migrations are applied by hand in this project, so a missing table is an
   * expected transient state rather than a bug. Surfaced explicitly because the
   * alternative — rendering zero failures — looks identical to a healthy
   * platform, which is the most dangerous thing this page could do.
   */
  unavailable: string[];
};

const DEFAULT_WINDOW_HOURS = 24;

/** Truncate a long provider message to something a table cell can hold. */
function trim(value: string | null | undefined, max = 240): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export async function getSystemHealth(
  params?: { windowHours?: number }
): Promise<SystemHealth> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  // Clamped: the window comes from a query string, and an unbounded value would
  // pull the entire history of every log table into one page.
  const windowHours = Math.min(Math.max(params?.windowHours ?? DEFAULT_WINDOW_HOURS, 1), 24 * 30);
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();

  // A stale check needs to look further back than the failure window: a monthly
  // job legitimately has no run inside 24 hours.
  const longestStaleWindow = Math.max(...JOB_METADATA.map((job) => job.staleAfterHours));
  const runsSince = new Date(
    Date.now() - Math.max(longestStaleWindow, windowHours) * 3600_000
  ).toISOString();

  const unavailable: string[] = [];

  const [
    runs,
    emailFailures,
    mailboxes,
    mydepositsErrors,
    tdsErrors,
    dpsErrors,
    webhookErrors,
    errorEvents,
    tenants,
  ] = await Promise.all([
    admin
      .from("platform_job_runs")
      .select("id, job_name, started_at, finished_at, duration_ms, status, trigger, error")
      .gte("started_at", runsSince)
      .order("started_at", { ascending: false })
      .limit(2000),
    admin
      .from("email_log")
      .select("id, tenant_id, provider_type, subject, error, sent_at")
      .eq("status", "failed")
      .gte("sent_at", since)
      .order("sent_at", { ascending: false })
      .limit(200),
    admin
      .from("email_providers")
      .select("tenant_id, type, status, last_error, verified_at")
      .in("status", ["error", "disabled"]),
    depositErrors(admin, "mydeposits_api_log", since),
    depositErrors(admin, "tds_api_log", since),
    depositErrors(admin, "dps_api_log", since),
    admin
      .from("boldsign_document_events")
      .select("id, tenant_id, event_type, process_error, received_at")
      .not("process_error", "is", null)
      .gte("received_at", since)
      .order("received_at", { ascending: false })
      .limit(100),
    admin
      .from("error_events")
      .select("id, tenant_id, source, message, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("tenants").select("id, name"),
  ]);

  const tenantNames = new Map(
    (tenants.data ?? []).map((row) => [row.id as string, row.name as string])
  );
  const nameOf = (tenantId: string | null) =>
    tenantId ? tenantNames.get(tenantId) ?? null : null;

  // ---------------------------------------------------------
  // Jobs
  // ---------------------------------------------------------
  const runsMissing = Boolean(runs.error);
  if (runsMissing) unavailable.push("platform_job_runs");

  const runRows = runs.data ?? [];
  const windowStart = new Date(since).getTime();

  const jobs: JobHealth[] = JOB_METADATA.map((meta) => {
    const forJob = runRows.filter((row) => row.job_name === meta.name);
    const last = forJob[0] ?? null;
    const lastSuccess = forJob.find((row) => row.status === "ok") ?? null;

    const inWindow = forJob.filter(
      (row) => new Date(row.started_at as string).getTime() >= windowStart
    );

    const staleCutoff = Date.now() - meta.staleAfterHours * 3600_000;

    return {
      ...meta,
      lastRunAt: (last?.started_at as string) ?? null,
      lastStatus: (last?.status as JobHealth["lastStatus"]) ?? null,
      lastDurationMs: (last?.duration_ms as number) ?? null,
      lastError: trim(last?.error as string | null),
      lastTrigger: (last?.trigger as JobHealth["lastTrigger"]) ?? null,
      failureCount: inWindow.filter((row) => row.status === "failed").length,
      skippedCount: inWindow.filter((row) => row.status === "skipped").length,
      // Unknown is not stale. Before the migration is applied, or on a freshly
      // deployed process, there is simply no data — claiming every job is broken
      // would train the operator to ignore this page.
      isStale: runsMissing
        ? false
        : !lastSuccess ||
          new Date(lastSuccess.started_at as string).getTime() < staleCutoff,
      unknown: runsMissing,
    };
  });

  // ---------------------------------------------------------
  // Failures, merged into one feed
  // ---------------------------------------------------------
  const failures: FailureEvent[] = [];

  if (!runsMissing) {
    for (const row of runRows) {
      if (row.status !== "failed") continue;
      if (new Date(row.started_at as string).getTime() < windowStart) continue;
      failures.push({
        id: `job:${row.id}`,
        source: "job",
        sourceLabel: "Job",
        occurredAt: row.started_at as string,
        tenantId: null,
        tenantName: null,
        summary: `${row.job_name} failed`,
        detail: trim(row.error as string | null),
      });
    }
  }

  if (emailFailures.error) {
    unavailable.push("email_log");
  } else {
    for (const row of emailFailures.data ?? []) {
      failures.push({
        id: `email:${row.id}`,
        source: "email",
        sourceLabel: "Email",
        occurredAt: row.sent_at as string,
        tenantId: (row.tenant_id as string) ?? null,
        tenantName: nameOf((row.tenant_id as string) ?? null),
        summary: `Send failed via ${row.provider_type}${
          row.subject ? ` — ${row.subject}` : ""
        }`,
        detail: trim(row.error as string | null),
      });
    }
  }

  for (const [table, label, result] of [
    ["mydeposits_api_log", "mydeposits", mydepositsErrors],
    ["tds_api_log", "TDS", tdsErrors],
    ["dps_api_log", "DPS", dpsErrors],
  ] as const) {
    if (result.error) {
      unavailable.push(table);
      continue;
    }
    for (const row of result.data ?? []) {
      failures.push({
        id: `deposit:${table}:${row.id}`,
        source: "deposit_api",
        sourceLabel: label,
        occurredAt: row.created_at as string,
        tenantId: (row.tenant_id as string) ?? null,
        tenantName: nameOf((row.tenant_id as string) ?? null),
        summary: `${row.method ?? "API"} ${row.path ?? ""} → ${row.status_code ?? "no status"}`.trim(),
        detail: trim(row.error as string | null),
      });
    }
  }

  if (webhookErrors.error) {
    unavailable.push("boldsign_document_events");
  } else {
    for (const row of webhookErrors.data ?? []) {
      failures.push({
        id: `webhook:${row.id}`,
        source: "webhook",
        sourceLabel: "BoldSign",
        occurredAt: row.received_at as string,
        tenantId: (row.tenant_id as string) ?? null,
        tenantName: nameOf((row.tenant_id as string) ?? null),
        summary: `Webhook ${row.event_type ?? "event"} could not be processed`,
        detail: trim(row.process_error as string | null),
      });
    }
  }

  if (errorEvents.error) {
    unavailable.push("error_events");
  } else {
    for (const row of errorEvents.data ?? []) {
      failures.push({
        id: `error:${row.id}`,
        source: "error_event",
        sourceLabel: String(row.source ?? "Error"),
        occurredAt: row.created_at as string,
        tenantId: (row.tenant_id as string) ?? null,
        tenantName: nameOf((row.tenant_id as string) ?? null),
        summary: trim(row.message as string, 160) ?? "Error",
        detail: null,
      });
    }
  }

  failures.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  // ---------------------------------------------------------
  // Mailboxes
  // ---------------------------------------------------------
  const brokenMailboxes: MailboxHealth[] = mailboxes.error
    ? []
    : (mailboxes.data ?? []).map((row) => ({
        tenantId: row.tenant_id as string,
        tenantName: nameOf(row.tenant_id as string),
        providerType: row.type as string,
        status: row.status as string,
        lastError: trim(row.last_error as string | null),
        verifiedAt: (row.verified_at as string) ?? null,
      }));

  if (mailboxes.error) unavailable.push("email_providers");

  return {
    windowHours,
    jobs,
    // Capped for rendering. The counts below are computed from the full set, so
    // the headline numbers stay accurate even when the feed is truncated.
    failures: failures.slice(0, 300),
    brokenMailboxes,
    counts: {
      jobFailures: failures.filter((f) => f.source === "job").length,
      emailFailures: failures.filter((f) => f.source === "email").length,
      integrationErrors: failures.filter(
        (f) => f.source === "deposit_api" || f.source === "webhook"
      ).length,
      staleJobs: jobs.filter((job) => job.isStale).length,
    },
    unavailable: Array.from(new Set(unavailable)),
  };
}

/**
 * Failed calls from one deposit scheme's API log.
 *
 * All three tables share a shape, so one helper covers them. `ok` is the flag
 * each scheme's client sets; a null status_code with ok=false is a transport
 * failure rather than an HTTP error.
 */
function depositErrors(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  since: string
) {
  return admin
    .from(table)
    .select("id, tenant_id, method, path, status_code, error, created_at")
    .eq("ok", false)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);
}

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserFromAccessTokenCookie } from "@/lib/auth/jwt";

/**
 * Writing to the platform audit log.
 *
 * See supabase/migrations/20260913000002_platform_audit_log.sql for why this is
 * a separate table from `activity_log` rather than a variation on it. The short
 * version: `tenant_id` here means the agency acted UPON, it is nullable so the
 * platform can log its own events, and no agency can read it.
 */

export type PlatformAuditCategory =
  | "tenant"
  | "billing"
  | "access"
  | "integration"
  | "system"
  | "security";

export type PlatformAuditSeverity = "info" | "warning" | "error";

/**
 * Who performed the action.
 *
 * `requireSuperAdmin()` returns a `user_profiles` row, which carries no email —
 * that lives in `auth.users`. Pass the profile and the email is filled in from
 * the request's own access token, which is a local decode rather than a round
 * trip. Pass `null` for the platform itself (cron, webhooks, sweeps).
 */
export type PlatformAuditActor = {
  id: string;
  email?: string | null;
  display_name?: string | null;
} | null;

export type PlatformAuditInput = {
  actor?: PlatformAuditActor;
  category: PlatformAuditCategory;
  /** Dotted, verb last: 'tenant.suspended', 'invoice.issued'. */
  action: string;
  /** One human-readable line. Rendered directly in the log view. */
  summary: string;
  /** The agency acted upon — NOT the actor's own. Null for platform-wide events. */
  tenantId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  severity?: PlatformAuditSeverity;
};

/**
 * Resolve the acting user's email without a network call.
 *
 * `cookies()` throws outside a request scope, which is exactly the case for a
 * cron job — so a throw here means "no request, no email", not an error worth
 * propagating.
 */
function resolveActorEmail(actor: PlatformAuditActor): string | null {
  if (!actor) return null;
  if (actor.email) return actor.email;

  try {
    const decoded = getUserFromAccessTokenCookie();
    // Only trust the token's email when it is the same person. A background
    // action running under one session but attributed to another user must not
    // borrow the session holder's address.
    if (decoded && decoded.id === actor.id && decoded.email) return decoded.email;
  } catch {
    // No request scope. Fall through.
  }

  return actor.display_name ?? null;
}

/**
 * Record one platform audit event.
 *
 * NEVER THROWS. An audit write that fails must not fail the operation it was
 * describing — refusing to suspend an agency because the log was unreachable
 * would turn an observability problem into an outage. The failure is reported
 * to the process log, which is itself captured by the system-health view.
 *
 * The trade-off is deliberate and worth stating: a lost audit row is preferable
 * to a blocked admin action *for this system*, where the log is an operational
 * record rather than a regulatory one. If it ever becomes the latter, this is
 * the function to reconsider.
 */
export async function logPlatformAudit(input: PlatformAuditInput): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const actor = input.actor ?? null;

    const { error } = await admin.from("platform_audit_log").insert({
      actor_user_id: actor?.id ?? null,
      actor_email: resolveActorEmail(actor),
      category: input.category,
      action: input.action,
      tenant_id: input.tenantId ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      summary: input.summary,
      before: input.before ?? null,
      after: input.after ?? null,
      metadata: input.metadata ?? null,
      severity: input.severity ?? "info",
    });

    if (error) {
      console.error("[audit] could not write platform audit row", {
        action: input.action,
        error: error.message,
      });
    }
  } catch (err) {
    console.error("[audit] could not write platform audit row", {
      action: input.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Reduce a before/after pair to only the fields that actually changed.
 *
 * Storing whole rows makes the log expensive to read and easy to ignore — the
 * reader has to diff two JSON blobs by eye to find the one field that moved.
 * Storing only the delta means the answer is the row.
 *
 * Returns nulls when nothing changed, so a no-op update logs as an event
 * without pretending a change occurred.
 */
export function auditDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): { before: Record<string, unknown> | null; after: Record<string, unknown> | null } {
  if (!before || !after) {
    return { before: before ?? null, after: after ?? null };
  }

  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    // JSON comparison rather than ===, so objects and arrays compare by value.
    // These are database rows: small, already JSON-serialisable, no cycles.
    const a = JSON.stringify(before[key] ?? null);
    const b = JSON.stringify(after[key] ?? null);
    if (a !== b) {
      changedBefore[key] = before[key] ?? null;
      changedAfter[key] = after[key] ?? null;
    }
  }

  if (Object.keys(changedAfter).length === 0) {
    return { before: null, after: null };
  }

  return { before: changedBefore, after: changedAfter };
}

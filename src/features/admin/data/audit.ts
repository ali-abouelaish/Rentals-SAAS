import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/requireRole";
import type { PlatformAuditCategory } from "@/lib/audit/platformAudit";

export type PlatformAuditRow = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  category: PlatformAuditCategory;
  action: string;
  tenant_id: string | null;
  tenant_name: string | null;
  entity_type: string | null;
  entity_id: string | null;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  severity: "info" | "warning" | "error";
};

export type PlatformAuditPage = {
  rows: PlatformAuditRow[];
  /** Distinct action names available to filter on. */
  actions: string[];
  /** True when the table is missing — migration not yet applied. */
  unavailable: boolean;
};

/** The category list is a fixed set in code, so it needs no query. */
export const AUDIT_CATEGORIES: { value: PlatformAuditCategory; label: string }[] = [
  { value: "tenant", label: "Agency" },
  { value: "billing", label: "Billing" },
  { value: "access", label: "Access & roles" },
  { value: "integration", label: "Integrations" },
  { value: "system", label: "System" },
  { value: "security", label: "Security" }
];

const MAX_LIMIT = 500;

function toJson(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function getPlatformAudit(params?: {
  category?: string;
  action?: string;
  severity?: string;
  tenantId?: string;
  /** Days back to include. Clamped to a year. */
  days?: number;
  limit?: number;
}): Promise<PlatformAuditPage> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const limit = Math.min(Math.max(params?.limit ?? 200, 1), MAX_LIMIT);
  const days = Math.min(Math.max(params?.days ?? 30, 1), 365);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  let query = admin
    .from("platform_audit_log")
    .select(
      "id, created_at, actor_user_id, actor_email, category, action, tenant_id, entity_type, entity_id, summary, before, after, metadata, severity"
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (params?.category && params.category !== "all") {
    query = query.eq("category", params.category);
  }
  if (params?.action && params.action !== "all") {
    query = query.eq("action", params.action);
  }
  if (params?.severity && params.severity !== "all") {
    query = query.eq("severity", params.severity);
  }
  // "" is the "platform-wide only" option — events with no subject agency, such
  // as a super-admin invite or a generation run. Distinct from "all", and it has
  // to be checked before the truthiness test below or an empty string would fall
  // through and silently apply no filter at all.
  if (params?.tenantId === "") {
    query = query.is("tenant_id", null);
  } else if (params?.tenantId && params.tenantId !== "all") {
    query = query.eq("tenant_id", params.tenantId);
  }

  // The action list is fetched INDEPENDENTLY of the filters above, and that is
  // the point. Deriving the dropdown from the returned page — as the tenant
  // activity view does — means it only ever offers actions present in the last N
  // rows, and narrows further the moment a filter is applied, so an option can
  // never be un-selected.
  const [{ data, error }, actionsResult, tenantsResult] = await Promise.all([
    query,
    admin
      .from("platform_audit_log")
      .select("action")
      .gte("created_at", since)
      .order("action", { ascending: true })
      .limit(5000),
    admin.from("tenants").select("id, name")
  ]);

  if (error) {
    return { rows: [], actions: [], unavailable: true };
  }

  const tenantNames = new Map(
    (tenantsResult.data ?? []).map((row) => [row.id as string, row.name as string])
  );

  // Actor display names, resolved in one query rather than per row.
  const actorIds = Array.from(
    new Set((data ?? []).map((row) => row.actor_user_id as string | null).filter(Boolean))
  ) as string[];

  const actorNames = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actors } = await admin
      .from("user_profiles")
      .select("id, display_name")
      .in("id", actorIds);
    for (const actor of actors ?? []) {
      if (actor.display_name) actorNames.set(actor.id as string, actor.display_name as string);
    }
  }

  const rows: PlatformAuditRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    created_at: row.created_at as string,
    actor_user_id: (row.actor_user_id as string) ?? null,
    actor_email: (row.actor_email as string) ?? null,
    actor_name: row.actor_user_id
      ? actorNames.get(row.actor_user_id as string) ?? null
      : null,
    category: row.category as PlatformAuditCategory,
    action: row.action as string,
    tenant_id: (row.tenant_id as string) ?? null,
    tenant_name: row.tenant_id ? tenantNames.get(row.tenant_id as string) ?? null : null,
    entity_type: (row.entity_type as string) ?? null,
    entity_id: (row.entity_id as string) ?? null,
    summary: row.summary as string,
    before: toJson(row.before),
    after: toJson(row.after),
    metadata: toJson(row.metadata),
    severity: (row.severity as PlatformAuditRow["severity"]) ?? "info"
  }));

  const actions = Array.from(
    new Set((actionsResult.data ?? []).map((row) => row.action as string))
  ).sort();

  return { rows, actions, unavailable: false };
}

/** Recent rows for the overview strip. */
export async function getRecentPlatformAudit(limit = 8): Promise<PlatformAuditRow[]> {
  const { rows } = await getPlatformAudit({ limit, days: 30 });
  return rows;
}

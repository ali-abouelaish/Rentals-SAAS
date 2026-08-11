// The allowlist that makes "any date column becomes automatable" safe: a
// date_offset trigger may ONLY reference keys in this registry. Each entry
// knows how to fetch the entities whose date lands on a target day — queries
// are built from these entries, never from user input.

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MessageEntityType, RecipientResolver } from "./types";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type DateFieldCandidate = {
  entityId: string;
  tenantId: string;
  /** The real-world date being reminded about (YYYY-MM-DD). */
  anchorISO: string;
  /** Raw row, for condition evaluation (e.g. status_in). */
  raw: Record<string, unknown>;
};

export type DateFieldEntry = {
  key: string;
  label: string;
  entityType: MessageEntityType;
  /** Sensible recipient default for the rule builder. */
  defaultResolver: RecipientResolver | null;
  /**
   * Entities whose date equals `anchorISO` for one tenant (or all tenants when
   * tenantId is null — the sweep passes null and groups by row tenant).
   */
  fetchDue: (admin: Admin, anchorISO: string, tenantId: string | null) => Promise<DateFieldCandidate[]>;
};

/** Generic fetcher for real date columns. */
function byColumn(opts: {
  table: string;
  column: string;
  select?: string;
  statusIn?: { column: string; values: string[] };
}): DateFieldEntry["fetchDue"] {
  return async (admin, anchorISO, tenantId) => {
    let query = admin
      .from(opts.table)
      .select(opts.select ?? `id, tenant_id, ${opts.column}`)
      .eq(opts.column, anchorISO);
    if (tenantId) query = query.eq("tenant_id", tenantId);
    if (opts.statusIn) query = query.in(opts.statusIn.column, opts.statusIn.values);
    const { data, error } = await query;
    if (error) throw new Error(`${opts.table}.${opts.column}: ${error.message}`);
    return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
      entityId: row.id as string,
      tenantId: row.tenant_id as string,
      anchorISO,
      raw: row,
    }));
  };
}

/**
 * Virtual field: the monthly rent due date derived from
 * property_contracts.collection_date (day-of-month 1-31). Replicates the
 * legacy getDueReminders semantics EXACTLY, including its quirk that
 * collection_date 31 never matches short months (no clamping), and the
 * renter-eligibility filters (reminders_enabled, active email, email present)
 * — required for dry-run parity with rent_reminder_log.
 */
const fetchRentDue: DateFieldEntry["fetchDue"] = async (admin, anchorISO, tenantId) => {
  let query = admin
    .from("property_contracts")
    .select(
      `id, tenant_id, start_date, collection_date, status,
       pm_tenant:pm_tenants(id, email, email_status, reminders_enabled)`
    )
    .eq("status", "active");
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data, error } = await query;
  if (error) throw new Error(`tenancy.rent_due_date: ${error.message}`);

  const targetDay = Number(anchorISO.slice(8, 10));
  const out: DateFieldCandidate[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    if (!row.collection_date || Number(row.collection_date) !== targetDay) continue;
    if (new Date(row.start_date as string) > new Date(anchorISO)) continue;
    const pmRel = row.pm_tenant;
    const pm = (Array.isArray(pmRel) ? pmRel[0] : pmRel) as
      | { email: string | null; email_status: string; reminders_enabled: boolean }
      | null;
    if (!pm) continue;
    if (!pm.reminders_enabled) continue;
    if (pm.email_status !== "active") continue;
    if (!pm.email) continue;
    out.push({
      entityId: row.id as string,
      tenantId: row.tenant_id as string,
      anchorISO,
      raw: row,
    });
  }
  return out;
};

export const DATE_FIELD_REGISTRY: Record<string, DateFieldEntry> = {
  "tenancy.rent_due_date": {
    key: "tenancy.rent_due_date",
    label: "Tenancy — rent due date (monthly)",
    entityType: "tenancy",
    defaultResolver: "tenancy_renter",
    fetchDue: fetchRentDue,
  },
  "tenancy.expiry_date": {
    key: "tenancy.expiry_date",
    label: "Tenancy — end date",
    entityType: "tenancy",
    defaultResolver: "tenancy_renter",
    fetchDue: byColumn({
      table: "property_contracts",
      column: "expiry_date",
      select: "id, tenant_id, expiry_date, status",
      statusIn: { column: "status", values: ["active", "signed", "notice_given"] },
    }),
  },
  "tenancy.start_date": {
    key: "tenancy.start_date",
    label: "Tenancy — start date",
    entityType: "tenancy",
    defaultResolver: "tenancy_renter",
    fetchDue: byColumn({
      table: "property_contracts",
      column: "start_date",
      select: "id, tenant_id, start_date, status",
      statusIn: { column: "status", values: ["active", "signed"] },
    }),
  },
  "pm_tenant.right_to_rent_expiry": {
    key: "pm_tenant.right_to_rent_expiry",
    label: "Tenant — right-to-rent expiry",
    entityType: "pm_tenant",
    defaultResolver: null,
    fetchDue: byColumn({
      table: "pm_tenants",
      column: "right_to_rent_expiry",
      select: "id, tenant_id, right_to_rent_expiry",
    }),
  },
  "owner.contract_expiry_date": {
    key: "owner.contract_expiry_date",
    label: "Owner landlord — contract expiry",
    entityType: "owner",
    defaultResolver: "property_owner",
    fetchDue: byColumn({
      table: "owner_landlords",
      column: "contract_expiry_date",
      select: "id, tenant_id, contract_expiry_date",
    }),
  },
  "certificate.expiry_date": {
    key: "certificate.expiry_date",
    label: "Certificate — expiry date",
    entityType: "certificate",
    defaultResolver: "certificate_issuer",
    fetchDue: byColumn({
      table: "certificates",
      column: "expiry_date",
      select: "id, tenant_id, expiry_date, type, contractor_id",
    }),
  },
  "works_order.scheduled_date": {
    key: "works_order.scheduled_date",
    label: "Works order — scheduled date",
    entityType: "works_order",
    defaultResolver: "works_order_contractor",
    fetchDue: byColumn({
      table: "maintenance_jobs",
      column: "scheduled_date",
      select: "id, tenant_id, scheduled_date, status",
      statusIn: {
        column: "status",
        values: ["open", "acknowledged", "in_progress", "pending_parts", "pending_quote"],
      },
    }),
  },
};

export const DATE_FIELD_KEYS = Object.keys(DATE_FIELD_REGISTRY);

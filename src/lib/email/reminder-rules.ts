import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ReminderType =
  | "upcoming_3d"
  | "due_today"
  // Legacy values kept so rent_reminder_log rows from earlier deploys still
  // type-check when read back. The cron no longer emits these.
  | "upcoming_5d"
  | "overdue_3d"
  | "overdue_7d"
  | "overdue_14d";

export type DueReminder = {
  reminderType: ReminderType;
  /** YYYY-MM-DD — the calendar date the rent was due (or will be due). */
  periodStart: string;
  periodYear: number;
  periodMonth: number;
  amountPcm: number;
  daysOverdue: number;

  tenantId: string;          // SaaS tenant = agency
  contractId: string;
  pmTenantId: string;
  pmTenantEmail: string;
  pmTenantName: string;
  propertyAddress: string;
};

type ReminderWindow = {
  type: ReminderType;
  /** Days from today; positive = future, negative = past. */
  offset: number;
  /** Whether to filter out contracts that are already paid for this period. */
  requirePaid: false;
  requireUnpaid: boolean;
};

const WINDOWS: ReminderWindow[] = [
  { type: "upcoming_3d", offset: 3, requirePaid: false, requireUnpaid: false },
  { type: "due_today",   offset: 0, requirePaid: false, requireUnpaid: false },
];

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type ContractRow = {
  id: string;
  tenant_id: string;
  pm_tenant_id: string;
  start_date: string;
  rent_pcm: number;
  collection_date: number | null;
  status: string;
  pm_tenant: {
    id: string;
    full_name: string;
    email: string;
    email_status: string;
    reminders_enabled: boolean;
  } | null;
  unit: {
    property: {
      address_line_1: string;
      address_line_2: string | null;
      postcode: string | null;
    } | null;
  } | null;
};

function buildAddress(unit: ContractRow["unit"]): string {
  const p = unit?.property;
  if (!p) return "";
  return [p.address_line_1, p.address_line_2, p.postcode]
    .filter(Boolean)
    .join(", ");
}

/**
 * For each reminder window (based on `today`), find every active contract
 * whose monthly due-date falls on `today + offset`, exclude contracts that
 * already have a matching log row, and (for overdue windows) exclude
 * contracts that already have a rent_payments row for that period.
 *
 * Idempotency is enforced at insert time by the unique
 * (contract_id, period_start, reminder_type) constraint, so a duplicate
 * here would be caught — but we filter early to avoid wasted sends.
 */
export async function getDueReminders(today: Date): Promise<DueReminder[]> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("property_contracts")
    .select(`
      id, tenant_id, pm_tenant_id, start_date, rent_pcm, collection_date, status,
      pm_tenant:pm_tenants(id, full_name, email, email_status, reminders_enabled),
      unit:units(
        property:properties(address_line_1, address_line_2, postcode)
      )
    `)
    .eq("status", "active");

  if (error) throw new Error(error.message);
  const contracts = (data ?? []) as unknown as ContractRow[];

  const reminders: DueReminder[] = [];

  for (const window of WINDOWS) {
    const targetDate = addDays(today, window.offset);
    const targetIso = toISODate(targetDate);
    const targetDay = targetDate.getDate();
    const periodYear = targetDate.getFullYear();
    const periodMonth = targetDate.getMonth() + 1;

    const candidates = contracts.filter((c) => {
      if (!c.collection_date) return false;
      if (c.collection_date !== targetDay) return false;
      if (!c.pm_tenant) return false;
      if (!c.pm_tenant.reminders_enabled) return false;
      if (c.pm_tenant.email_status !== "active") return false;
      if (!c.pm_tenant.email) return false;
      return new Date(c.start_date) <= targetDate;
    });

    if (candidates.length === 0) continue;

    const candidateIds = candidates.map((c) => c.id);

    const { data: existing, error: existingErr } = await admin
      .from("rent_reminder_log")
      .select("contract_id")
      .in("contract_id", candidateIds)
      .eq("period_start", targetIso)
      .eq("reminder_type", window.type);
    if (existingErr) throw new Error(existingErr.message);
    const alreadySent = new Set(((existing ?? []) as { contract_id: string }[]).map((r) => r.contract_id));

    let paidIds = new Set<string>();
    if (window.requireUnpaid) {
      const { data: payments, error: paymentsErr } = await admin
        .from("rent_payments")
        .select("contract_id")
        .in("contract_id", candidateIds)
        .eq("period_year", periodYear)
        .eq("period_month", periodMonth);
      if (paymentsErr) throw new Error(paymentsErr.message);
      paidIds = new Set(((payments ?? []) as { contract_id: string }[]).map((r) => r.contract_id));
    }

    for (const c of candidates) {
      if (alreadySent.has(c.id)) continue;
      if (window.requireUnpaid && paidIds.has(c.id)) continue;

      reminders.push({
        reminderType: window.type,
        periodStart: targetIso,
        periodYear,
        periodMonth,
        amountPcm: Number(c.rent_pcm),
        daysOverdue: Math.max(0, -window.offset),
        tenantId: c.tenant_id,
        contractId: c.id,
        pmTenantId: c.pm_tenant!.id,
        pmTenantEmail: c.pm_tenant!.email,
        pmTenantName: c.pm_tenant!.full_name,
        propertyAddress: buildAddress(c.unit),
      });
    }
  }

  return reminders;
}

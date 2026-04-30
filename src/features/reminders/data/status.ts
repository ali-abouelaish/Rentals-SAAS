import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ReminderKind = "no_contract" | "upcoming" | "due_today" | "overdue";

export type ReminderStatus = {
  kind: ReminderKind;
  /** > 0 when overdue, 0 when due today, < 0 when upcoming. */
  daysOverdue: number;
  /** YYYY-MM-DD of the most recent collection date relevant to this contract. */
  dueDate: string | null;
};

export type ReminderStatusMap = Record<string, ReminderStatus>;

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function clampDayToMonth(year: number, monthIndex0: number, day: number): number {
  return Math.min(day, daysInMonth(year, monthIndex0));
}

function diffDays(later: Date, earlier: Date): number {
  const ms = 24 * 60 * 60 * 1000;
  // Normalize to midnight to avoid DST drift influencing the count.
  const a = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  const b = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.round((a - b) / ms);
}

type Contract = {
  id: string;
  pm_tenant_id: string;
  start_date: string;
  collection_date: number | null;
  status: string;
};

/**
 * Computes a reminder status per pm_tenant for the given ids:
 *   - no_contract: no active contract found, or no collection_date set
 *   - overdue:     today's date is past the most recent collection date and
 *                  no rent_payments row exists for that period
 *   - due_today:   today is exactly the most recent collection date
 *   - upcoming:    today is before the next collection date
 *
 * Single batched query for contracts + rent payments; safe to call on a
 * full list page render.
 */
export async function getRentReminderStatusMap(
  pmTenantIds: string[]
): Promise<ReminderStatusMap> {
  if (pmTenantIds.length === 0) return {};

  const supabase = createSupabaseServerClient();

  // Mirrors ACTIVE_CONTRACT_STATUSES in features/pm-tenants/data/pm-tenants.ts
  // — a contract can be the renter's "current" one without literally being
  // status='active' (e.g. signed but not yet flipped, or notice_given).
  const { data: contracts, error: contractsErr } = await supabase
    .from("property_contracts")
    .select("id, pm_tenant_id, start_date, collection_date, status")
    .in("pm_tenant_id", pmTenantIds)
    .in("status", ["active", "signed", "notice_given"]);
  if (contractsErr) throw new Error(contractsErr.message);

  const allRows = (contracts ?? []) as Contract[];
  // Keep the latest contract per pm_tenant when multiple are returned.
  const byPm = new Map<string, Contract>();
  for (const c of allRows) {
    const existing = byPm.get(c.pm_tenant_id);
    if (!existing || c.start_date > existing.start_date) byPm.set(c.pm_tenant_id, c);
  }
  const rows = Array.from(byPm.values());

  const result: ReminderStatusMap = {};
  for (const id of pmTenantIds) {
    result[id] = { kind: "no_contract", daysOverdue: 0, dueDate: null };
  }
  if (rows.length === 0) return result;

  const contractIds = rows.map((c) => c.id);
  const { data: payments, error: paymentsErr } = await supabase
    .from("rent_payments")
    .select("contract_id, period_year, period_month")
    .in("contract_id", contractIds);
  if (paymentsErr) throw new Error(paymentsErr.message);
  const paid = new Set(
    ((payments ?? []) as { contract_id: string; period_year: number; period_month: number }[]).map(
      (p) => `${p.contract_id}:${p.period_year}:${p.period_month}`
    )
  );

  const today = new Date();

  for (const c of rows) {
    // Contract exists but collection_date is unset — still surface a button so
    // the admin can act; send-now will return a clear error if they try.
    if (!c.collection_date) {
      result[c.pm_tenant_id] = { kind: "upcoming", daysOverdue: 0, dueDate: null };
      continue;
    }
    const startDate = new Date(c.start_date);

    // Most recent collection date that's <= today.
    const tDay = today.getDate();
    let dueYear = today.getFullYear();
    let dueMonthIdx = today.getMonth();
    if (tDay < c.collection_date) {
      // The current month's collection hasn't happened yet — fall back to
      // the previous month's, but only if the contract had started by then.
      dueMonthIdx -= 1;
      if (dueMonthIdx < 0) {
        dueMonthIdx = 11;
        dueYear -= 1;
      }
    }
    const dueDay = clampDayToMonth(dueYear, dueMonthIdx, c.collection_date);
    const dueDate = new Date(dueYear, dueMonthIdx, dueDay);
    if (dueDate < startDate) continue;

    const periodYear = dueYear;
    const periodMonth = dueMonthIdx + 1;
    const isPaid = paid.has(`${c.id}:${periodYear}:${periodMonth}`);
    const days = diffDays(today, dueDate);

    let kind: ReminderKind;
    if (days === 0) kind = isPaid ? "upcoming" : "due_today";
    else if (days > 0) kind = isPaid ? "upcoming" : "overdue";
    else kind = "upcoming";

    result[c.pm_tenant_id] = {
      kind,
      daysOverdue: kind === "overdue" ? days : 0,
      dueDate: dueDate.toISOString().slice(0, 10),
    };
  }

  return result;
}

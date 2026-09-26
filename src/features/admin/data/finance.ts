import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/requireRole";
import { billingPeriod, type BillingPeriod } from "@/lib/billing/rates";
import {
  expenseAmountForMonth,
  getExpenseCategory,
  marginPercent,
  monthlyRunRatePence,
  type CostMode,
  type ExpenseCategory,
  type ExpenseRule,
} from "@/lib/finance/platformExpenses";

/**
 * The platform P&L: what Harbor Ops earns against what it costs to run.
 *
 * Revenue comes from `tenant_platform_invoices` and is reported on two bases,
 * because for this business they differ materially and each answers a different
 * question:
 *
 *   INVOICED  (issued + paid) — what was billed. The accrual figure, and the one
 *             profit is calculated against. Drafts are excluded: a draft has not
 *             been sent and may still change.
 *   COLLECTED (paid)          — what actually arrived. No payment processor is
 *             involved here, so an invoice is only paid when a human marks it
 *             paid, and the gap between the two is real money outstanding.
 *
 * Expenses are expanded from stored rules per month — see
 * src/lib/finance/platformExpenses.ts for why there is no posted ledger.
 */

export type PlatformExpense = {
  id: string;
  category: ExpenseCategory;
  categoryLabel: string;
  label: string;
  vendor: string | null;
  amountPence: number;
  costMode: CostMode;
  startsOn: string;
  endsOn: string | null;
  amortiseMonths: number | null;
  isActive: boolean;
  notes: string | null;
  /** What this contributes to the month currently in view. */
  monthAmountPence: number;
};

export type FinanceMonth = {
  year: number;
  month: number;
  label: string;
  /** Short label for the chart axis, e.g. "Sep". */
  shortLabel: string;
  invoicedPence: number;
  collectedPence: number;
  expensesPence: number;
  /** invoiced − expenses. Can be negative. */
  netPence: number;
};

export type CategoryBreakdown = {
  category: ExpenseCategory;
  label: string;
  amountPence: number;
  /** Share of the month's expenses, 0–100. */
  share: number;
};

export type PlatformFinance = {
  period: BillingPeriod;
  periodLabel: string;
  /** Oldest first, ending with `period`. Drives the chart. */
  series: FinanceMonth[];
  current: FinanceMonth;
  /** Margin for `period`, or null when there was no revenue to divide by. */
  marginPercent: number | null;
  /** Active recurring costs per month — the standing burn. */
  runRatePence: number;
  breakdown: CategoryBreakdown[];
  expenses: PlatformExpense[];
  /** Totals across the whole series, for the headline tiles. */
  totals: {
    invoicedPence: number;
    collectedPence: number;
    expensesPence: number;
    netPence: number;
  };
  unavailable: string[];
};

const DEFAULT_MONTHS = 12;

function monthLabel(year: number, month: number, short = false): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: short ? "short" : "long",
    year: short ? undefined : "numeric",
    timeZone: "UTC",
  });
}

/** The `months` periods ending at `period`, oldest first. */
function trailingMonths(period: BillingPeriod, months: number): BillingPeriod[] {
  const out: BillingPeriod[] = [];
  for (let back = months - 1; back >= 0; back -= 1) {
    // Date.UTC normalises a negative month index into the previous year, so no
    // wrap-around arithmetic is needed here.
    const d = new Date(Date.UTC(period.year, period.month - 1 - back, 1));
    out.push(billingPeriod(d.getUTCFullYear(), d.getUTCMonth() + 1));
  }
  return out;
}

export async function getPlatformFinance(params?: {
  year?: number;
  month?: number;
  months?: number;
}): Promise<PlatformFinance> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const now = new Date();
  const year = params?.year ?? now.getUTCFullYear();
  const month = params?.month ?? now.getUTCMonth() + 1;
  const period = billingPeriod(year, month);

  // Clamped: the range comes from a query string, and the series is rendered as
  // a chart that stops being readable long before it stops being computable.
  const months = Math.min(Math.max(params?.months ?? DEFAULT_MONTHS, 3), 36);
  const windows = trailingMonths(period, months);

  const unavailable: string[] = [];

  const [invoicesResult, expensesResult] = await Promise.all([
    admin
      .from("tenant_platform_invoices")
      .select("period_year, period_month, total_pence, status")
      // Void invoices are not revenue on any basis.
      .neq("status", "void"),
    admin
      .from("platform_expenses")
      .select(
        "id, category, label, vendor, amount_pence, cost_mode, starts_on, ends_on, amortise_months, is_active, notes"
      )
      .order("is_active", { ascending: false })
      .order("amount_pence", { ascending: false }),
  ]);

  if (invoicesResult.error) unavailable.push("tenant_platform_invoices");
  if (expensesResult.error) unavailable.push("platform_expenses");

  // ---------------------------------------------------------
  // Revenue, bucketed by the period the invoice is FOR — not when it was issued
  // or paid. A September invoice settled in October is September revenue;
  // bucketing by payment date would make a slow payer look like a bad month
  // followed by a good one.
  // ---------------------------------------------------------
  const invoicedByMonth = new Map<string, number>();
  const collectedByMonth = new Map<string, number>();

  for (const row of invoicesResult.data ?? []) {
    const key = `${row.period_year}-${row.period_month}`;
    const total = (row.total_pence as number) ?? 0;
    const status = row.status as string;

    if (status === "issued" || status === "paid") {
      invoicedByMonth.set(key, (invoicedByMonth.get(key) ?? 0) + total);
    }
    if (status === "paid") {
      collectedByMonth.set(key, (collectedByMonth.get(key) ?? 0) + total);
    }
  }

  // ---------------------------------------------------------
  // Expenses
  // ---------------------------------------------------------
  const expenseRows = expensesResult.data ?? [];

  const rules: (ExpenseRule & { row: Record<string, unknown> })[] = expenseRows.map((row) => ({
    amountPence: row.amount_pence as number,
    costMode: row.cost_mode as CostMode,
    startsOn: row.starts_on as string,
    endsOn: (row.ends_on as string | null) ?? null,
    amortiseMonths: (row.amortise_months as number | null) ?? null,
    isActive: row.is_active as boolean,
    row,
  }));

  const series: FinanceMonth[] = windows.map((w) => {
    const key = `${w.year}-${w.month}`;
    const invoiced = invoicedByMonth.get(key) ?? 0;
    const collected = collectedByMonth.get(key) ?? 0;
    const expenses = rules.reduce(
      (sum, rule) => sum + expenseAmountForMonth(rule, w.year, w.month),
      0
    );

    return {
      year: w.year,
      month: w.month,
      label: monthLabel(w.year, w.month),
      shortLabel: monthLabel(w.year, w.month, true),
      invoicedPence: invoiced,
      collectedPence: collected,
      expensesPence: expenses,
      netPence: invoiced - expenses,
    };
  });

  const current = series[series.length - 1];

  // Per-expense contribution to the month in view, so the list can show what
  // each row actually costs this month rather than only its headline amount —
  // for an amortised cost those are different numbers.
  const expenses: PlatformExpense[] = rules.map((rule) => {
    const row = rule.row;
    const category = row.category as ExpenseCategory;
    return {
      id: row.id as string,
      category,
      categoryLabel: getExpenseCategory(category)?.label ?? category,
      label: row.label as string,
      vendor: (row.vendor as string | null) ?? null,
      amountPence: row.amount_pence as number,
      costMode: row.cost_mode as CostMode,
      startsOn: row.starts_on as string,
      endsOn: (row.ends_on as string | null) ?? null,
      amortiseMonths: (row.amortise_months as number | null) ?? null,
      isActive: row.is_active as boolean,
      notes: (row.notes as string | null) ?? null,
      monthAmountPence: expenseAmountForMonth(rule, period.year, period.month),
    };
  });

  // ---------------------------------------------------------
  // Category breakdown for the month in view
  // ---------------------------------------------------------
  const byCategory = new Map<ExpenseCategory, number>();
  for (const expense of expenses) {
    if (expense.monthAmountPence <= 0) continue;
    byCategory.set(
      expense.category,
      (byCategory.get(expense.category) ?? 0) + expense.monthAmountPence
    );
  }

  const breakdown: CategoryBreakdown[] = Array.from(byCategory.entries())
    .map(([category, amountPence]) => ({
      category,
      label: getExpenseCategory(category)?.label ?? category,
      amountPence,
      share:
        current.expensesPence > 0
          ? Math.round((amountPence / current.expensesPence) * 100)
          : 0,
    }))
    .sort((a, b) => b.amountPence - a.amountPence);

  const totals = series.reduce(
    (acc, m) => ({
      invoicedPence: acc.invoicedPence + m.invoicedPence,
      collectedPence: acc.collectedPence + m.collectedPence,
      expensesPence: acc.expensesPence + m.expensesPence,
      netPence: acc.netPence + m.netPence,
    }),
    { invoicedPence: 0, collectedPence: 0, expensesPence: 0, netPence: 0 }
  );

  return {
    period,
    periodLabel: monthLabel(period.year, period.month),
    series,
    current,
    marginPercent: marginPercent(current.invoicedPence, current.expensesPence),
    runRatePence: monthlyRunRatePence(rules, period.year, period.month),
    breakdown,
    expenses,
    totals,
    unavailable: Array.from(new Set(unavailable)),
  };
}

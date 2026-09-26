/**
 * Harbor Ops' own operating costs: categories, and how a cost lands on a month.
 *
 * Dependency-free on purpose — no `server-only`, no database client — so it
 * loads under `node --test` and can be imported from a client component. Same
 * convention as `meters.ts`, `packs.ts` and `rates.ts`.
 *
 * The month-expansion below is the whole point of the module. Expenses are
 * stored once, as a rule ("£200 a month from September"), and expanded on read
 * into the months they affect. There is no posted ledger and no monthly job:
 * with a few dozen rows the expansion is trivial, and a stored ledger would be a
 * second copy of the truth that drifts the moment someone edits an expense.
 */

export type ExpenseCategory =
  | "infrastructure"
  | "integrations"
  | "ai"
  | "software"
  | "domains"
  | "payroll"
  | "contractors"
  | "marketing"
  | "professional_fees"
  | "bank_fees"
  | "other";

export type CostMode = "recurring" | "one_off" | "amortised";

export type ExpenseCategoryMeta = {
  key: ExpenseCategory;
  label: string;
  /** Shown as the field hint when picking a category. */
  hint: string;
};

export const EXPENSE_CATEGORIES: ExpenseCategoryMeta[] = [
  {
    key: "infrastructure",
    label: "Infrastructure",
    hint: "The VPS, Supabase, storage, bandwidth — what it costs to keep the app running.",
  },
  {
    key: "integrations",
    label: "Integrations",
    hint: "BoldSign, Resend, deposit schemes, the scraper API. Costs that scale with what agencies use.",
  },
  { key: "ai", label: "AI", hint: "OpenAI and any other model provider." },
  {
    key: "software",
    label: "Software",
    hint: "GitHub, design tools, and the rest of the SaaS stack you pay for.",
  },
  { key: "domains", label: "Domains & TLS", hint: "Domain registration, DNS, certificates." },
  { key: "payroll", label: "Payroll", hint: "Salaries and employment costs." },
  { key: "contractors", label: "Contractors", hint: "Freelancers and agencies paid per engagement." },
  { key: "marketing", label: "Marketing", hint: "Ads, content, events, anything spent on acquisition." },
  {
    key: "professional_fees",
    label: "Professional fees",
    hint: "Accountant, solicitor, and other professional advice.",
  },
  { key: "bank_fees", label: "Bank & payment fees", hint: "Account fees, transfer and FX charges." },
  { key: "other", label: "Other", hint: "Anything that does not fit the categories above." },
];

const CATEGORY_BY_KEY = new Map(EXPENSE_CATEGORIES.map((c) => [c.key, c]));

export function getExpenseCategory(key: string): ExpenseCategoryMeta | null {
  return CATEGORY_BY_KEY.get(key as ExpenseCategory) ?? null;
}

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return CATEGORY_BY_KEY.has(value as ExpenseCategory);
}

export const COST_MODE_LABELS: Record<CostMode, string> = {
  recurring: "Recurring monthly",
  one_off: "One-off",
  amortised: "Spread over months",
};

/** The shape the month-expansion needs. A subset of the database row. */
export type ExpenseRule = {
  amountPence: number;
  costMode: CostMode;
  /** `YYYY-MM-DD`. When it starts, or when a one-off was incurred. */
  startsOn: string;
  /** `YYYY-MM-DD`. Recurring only; null means ongoing. */
  endsOn: string | null;
  /** Amortised only: the term in months. */
  amortiseMonths: number | null;
  isActive: boolean;
};

/** First day of a month as `YYYY-MM-DD`. */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * What one expense contributes to one month, in pence.
 *
 * Comparisons are on `YYYY-MM-DD` strings rather than Date objects. These are
 * plain calendar dates with no time and no zone, and parsing them into Dates is
 * how a cost ends up on the wrong side of a month boundary for anyone west of
 * UTC. Lexicographic comparison on ISO dates is the same as chronological.
 */
export function expenseAmountForMonth(
  rule: ExpenseRule,
  year: number,
  month: number
): number {
  if (!rule.isActive) return 0;

  const monthStart = monthKey(year, month);
  // Exclusive upper bound: the 1st of the next month.
  const monthEnd = month === 12 ? monthKey(year + 1, 1) : monthKey(year, month + 1);

  switch (rule.costMode) {
    case "one_off":
      // Lands entirely in the month it was incurred.
      return rule.startsOn >= monthStart && rule.startsOn < monthEnd
        ? rule.amountPence
        : 0;

    case "recurring": {
      // Not yet started. This is the check business_overheads is missing, and
      // without it adding a subscription today would charge it to every month
      // that has ever existed.
      if (rule.startsOn >= monthEnd) return 0;
      // Already ended. `endsOn` is inclusive of its own month, so a cost ending
      // 15 March still charges March in full — a monthly subscription cancelled
      // mid-month was paid for that month.
      if (rule.endsOn && rule.endsOn < monthStart) return 0;
      return rule.amountPence;
    }

    case "amortised": {
      if (!rule.amortiseMonths || rule.amortiseMonths <= 0) return 0;

      const startYear = Number(rule.startsOn.slice(0, 4));
      const startMonth = Number(rule.startsOn.slice(5, 7));

      // Whole months elapsed since the term began.
      const elapsed = (year - startYear) * 12 + (month - startMonth);
      if (elapsed < 0 || elapsed >= rule.amortiseMonths) return 0;

      const slice = Math.floor(rule.amountPence / rule.amortiseMonths);

      // The final month absorbs the rounding remainder, so the slices sum to
      // exactly the amount paid. Spreading £1000 over 3 months as 333/333/333
      // loses a penny; here it is 333/333/334.
      if (elapsed === rule.amortiseMonths - 1) {
        return rule.amountPence - slice * (rule.amortiseMonths - 1);
      }
      return slice;
    }

    default:
      return 0;
  }
}

/**
 * The monthly run rate: what the active recurring costs come to per month.
 *
 * Recurring only — a one-off is not a run rate, and an amortised cost is a past
 * payment being spread rather than money going out each month.
 */
export function monthlyRunRatePence(
  rules: ExpenseRule[],
  year: number,
  month: number
): number {
  return rules
    .filter((rule) => rule.costMode === "recurring")
    .reduce((sum, rule) => sum + expenseAmountForMonth(rule, year, month), 0);
}

/** Net margin as a percentage, guarding the zero-revenue case. */
export function marginPercent(revenuePence: number, expensesPence: number): number | null {
  if (revenuePence <= 0) return null;
  return Math.round(((revenuePence - expensesPence) / revenuePence) * 100);
}

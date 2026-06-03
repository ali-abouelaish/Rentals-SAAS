/** YYYY-MM key, e.g. "2026-06". */
export type MonthKey = `${number}-${number}`;

export type FinanceCostCategoryBreakdown = {
  key: string;
  label: string;
  amount: number; // pence
};

export type FinancePortfolioBreakdown = {
  portfolio_id: string;
  portfolio_name: string;
  portfolio_color: string;
  rent_expected: number; // pence
  rent_received: number; // pence
  property_costs: number; // pence
  owner_rent: number; // pence
  net_profit: number; // pence
};

export type FinancePropertyBreakdown = {
  property_id: string;
  property_name: string;
  portfolio_id: string;
  portfolio_name: string;
  portfolio_color: string;
  rent_expected: number; // pence
  rent_received: number; // pence
  property_costs: number; // pence
  owner_rent: number; // pence
  net_profit: number; // pence
};

export type FinanceMonthRollup = {
  year: number;
  month: number; // 1..12
  month_key: MonthKey;
  month_label: string; // "June 2026"
  is_current_month: boolean;
  is_future_month: boolean;

  // Income (pence)
  rent_expected: number;
  rent_received: number;
  rent_outstanding: number; // max(0, expected - received)
  tenant_charges_expected: number; // recurring tenant-side charges (utilities etc.) — expected for the month

  // Costs (pence)
  property_costs: number; // sum of property_costs applicable to month
  owner_rent: number; // sum of (monthly_rent_owed × 100 / divisor) across properties
  admin_overheads: number; // sum of business_overheads applicable to month
  total_costs: number;

  // Losses (pence) — only meaningful for current month (no historical unit-state log)
  vacancy_loss: number;

  // Net (pence) — uses received rent (cash basis) minus costs minus current-month vacancy loss
  net_profit: number;

  // Reconciliation (pence)
  bank_credits_total: number;
  bank_credits_matched: number;
  bank_credits_unmatched: number;

  // Breakdown
  by_portfolio: FinancePortfolioBreakdown[];
  by_property: FinancePropertyBreakdown[];
  costs_by_category: FinanceCostCategoryBreakdown[];
};

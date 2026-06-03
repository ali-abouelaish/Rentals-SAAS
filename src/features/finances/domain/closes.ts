export type MonthlyCloseStatus = "open" | "in_review" | "closed";

export type MonthlyCloseChecklist = {
  rent_recorded: boolean;
  recurring_posted: boolean;
  bank_reconciled: boolean;
  costs_reviewed: boolean;
  overheads_reviewed: boolean;
};

export const EMPTY_CHECKLIST: MonthlyCloseChecklist = {
  rent_recorded: false,
  recurring_posted: false,
  bank_reconciled: false,
  costs_reviewed: false,
  overheads_reviewed: false,
};

export type MonthlyCloseSnapshot = {
  rent_expected: number;
  rent_received: number;
  rent_outstanding: number;
  tenant_charges_expected: number;
  property_costs: number;
  owner_rent: number;
  admin_overheads: number;
  total_costs: number;
  vacancy_loss: number;
  net_profit: number;
  bank_credits_total: number;
  bank_credits_matched: number;
  bank_credits_unmatched: number;
  by_portfolio: Array<{
    portfolio_id: string;
    portfolio_name: string;
    rent_received: number;
    property_costs: number;
    owner_rent: number;
    net_profit: number;
  }>;
  by_property: Array<{
    property_id: string;
    property_name: string;
    portfolio_name: string;
    rent_received: number;
    property_costs: number;
    owner_rent: number;
    net_profit: number;
  }>;
  costs_by_category: Array<{ key: string; label: string; amount: number }>;
};

export type MonthlyClose = {
  id: string;
  tenant_id: string;
  year: number;
  month: number;
  status: MonthlyCloseStatus;
  checklist: MonthlyCloseChecklist;
  snapshot: MonthlyCloseSnapshot | null;
  notes: string | null;
  closed_at: string | null;
  closed_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  created_at: string;
  updated_at: string;
};

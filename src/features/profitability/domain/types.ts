export type CostType =
  | "council_tax"
  | "bills"
  | "cleaning"
  | "maintenance"
  | "insurance"
  | "owner_rent"
  | "agency_fee"
  | "furniture"
  | "other";

export type CostMode = "recurring" | "one_off" | "amortised";

export type AlertType =
  | "profitability_below_target"
  | "vacancy_running"
  | "vacancy_upcoming"
  | "cost_spike"
  | "deposit_deadline"
  | "landlord_contract_expiry"
  | "notice_vacate_approaching";

export type PropertyTarget = {
  id: string;
  tenant_id: string;
  property_id: string;
  target_profit_pcm: number; // £ (not pence)
  created_at: string;
  updated_at: string;
};

export type PropertyCost = {
  id: string;
  tenant_id: string;
  property_id: string;
  unit_id: string | null;
  cost_type: CostType;
  cost_label: string | null;
  amount: number; // pence
  cost_mode: CostMode;
  recurrence_day: number | null;
  amortise_months: number | null;
  amortise_start_date: string | null;
  purchase_date: string | null;
  date_incurred: string;
  notes: string | null;
  created_at: string;
  // Phase 4: maintenance integration
  source?: "manual" | "maintenance";
  source_id?: string | null; // maintenance_jobs.id when source = 'maintenance'
};

export type ProfitabilityAlert = {
  id: string;
  tenant_id: string;
  property_id: string;
  unit_id: string | null;
  alert_type: AlertType;
  triggered_at: string;
  resolved_at: string | null;
  is_resolved: boolean;
  metadata: Record<string, unknown>;
  email_sent: boolean;
  // Joined
  property_name?: string;
  unit_label?: string | null;
  portfolio_name?: string;
  portfolio_color?: string;
};

// Computed per-unit breakdown
export type UnitProfitRow = {
  unit_id: string;
  unit_label: string; // e.g. "Room 3 · Double"
  tenant_name: string | null; // null = vacant
  rent_pcm: number; // pence — from active contract, 0 if vacant
  days_vacant: number;
  vacancy_loss: number; // pence
  net_contribution: number; // pence
  status: string;
};

// Computed per-property P&L
export type PropertyProfitability = {
  property_id: string;
  property_name: string;
  portfolio_id: string;
  portfolio_name: string;
  portfolio_color: string;
  total_units: number;
  occupied_units: number;
  total_income: number; // pence this period
  total_costs: number; // pence this period (recurring + one-off)
  vacancy_loss: number; // pence this period
  net_profit: number; // pence this period
  target_profit: number | null; // pence (target_profit_pcm × 100), null if no target
  vs_target: number | null; // pence, positive = above target
  last_month_net_profit: number | null; // pence
  trend: "up" | "down" | "flat" | null;
  unit_breakdown: UnitProfitRow[];
  costs: PropertyCost[];
};

// For the portfolio line graph (monthly rollup per portfolio)
export type PortfolioMonthPoint = {
  month: string; // "Apr 25", "May 25", etc.
  [portfolioName: string]: number | string; // portfolio_name → net profit £
};

// Dashboard-specific types
export type VacancyUnit = {
  unit_id: string;
  unit_label: string;
  property_id: string;
  property_name: string;
  portfolio_name: string;
  portfolio_color: string;
  status: "vacant" | "move_out" | "replacement";
  days_vacant: number;
  days_until_vacant: number | null; // for upcoming
  daily_loss: number; // £ per day
  total_loss: number; // £ total so far
};

export type UpcomingMoveOut = {
  unit_id: string;
  unit_label: string;
  property_id: string;
  property_name: string;
  tenant_name: string | null;
  vacate_date: string;
  days_remaining: number;
  contract_status: string;
};

export type MaintenanceSummary = {
  open_jobs: number;
  in_progress_jobs: number;
  critical_jobs: number;
  resolved_this_month: number;
  total_cost_this_month: number; // pence
};

export type DashboardData = {
  total_units: number;
  occupied_units: number;
  vacant_units: number;
  daily_vacancy_loss: number; // £
  total_rent_roll: number; // £ PCM (sum of active contract rents)
  alerts: ProfitabilityAlert[];
  vacancy_units: VacancyUnit[];
  upcoming_move_outs: UpcomingMoveOut[];
  top_properties: PropertyProfitability[]; // top 3 by net profit
  worst_properties: PropertyProfitability[]; // bottom 3 by net profit
  portfolio_net_profit_this_month: number; // £
  portfolio_net_profit_last_month: number; // £
  maintenance_summary: MaintenanceSummary;
};

export const COST_TYPE_LABELS: Record<CostType, string> = {
  council_tax: "Council Tax",
  bills: "Bills",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
  insurance: "Insurance",
  owner_rent: "Owner Rent",
  agency_fee: "Agency Fee",
  furniture: "Furniture",
  other: "Other",
};

export const COST_MODE_LABELS: Record<CostMode, string> = {
  recurring: "Recurring",
  one_off: "One-off",
  amortised: "Amortised",
};

export const ALERT_CONFIG: Record<
  AlertType,
  { label: string; urgency: "red" | "amber" | "yellow" | "orange" }
> = {
  profitability_below_target: {
    label: "Profitability Below Target",
    urgency: "red",
  },
  vacancy_running: { label: "Vacancy Running", urgency: "amber" },
  vacancy_upcoming: { label: "Vacancy Upcoming", urgency: "yellow" },
  cost_spike: { label: "Cost Spike Detected", urgency: "orange" },
  deposit_deadline: { label: "Deposit Protection Deadline", urgency: "red" },
  landlord_contract_expiry: {
    label: "Landlord Contract Expiring",
    urgency: "red",
  },
  notice_vacate_approaching: {
    label: "Vacate Date Approaching",
    urgency: "amber",
  },
};

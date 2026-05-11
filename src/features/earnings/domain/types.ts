export type EarningsStats = {
  totalAgents: number;
  totalEarnings: number;
  totalTransactions: number;
  totalRentalsClosed?: number;
  totalRentalsPending?: number;
  avgPerAgent: number;
  topAgentName?: string | null;
  topAgentEarnings?: number | null;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
};

export type EarningsTrendPoint = {
  bucket_date: string;
  total_earnings: number;
  agent_earnings: number;
};

export type EarningsLeaderboardRow = {
  agent_id: string;
  agent_name: string;
  avatar_url: string | null;
  transactions_count: number;
  agent_earnings: number;
  agency_earnings: number;
  total_earnings: number;
  bonus_earnings: number;
  combined_earnings: number;
  last_activity: string | null;
  commission_percent: number | null;
  rank: number;
};

/** Single closed rental / commission event for export and agent profile */
export type EarningsTransaction = {
  id: string;
  agent_id: string;
  code: string;
  client_name: string;
  amount: number;
  consultation_fee?: number;
  payment_method?: string;
  marketing_agents?: string[];
  created_at: string;
  role?: "assisted" | "marketing";
  status?: string;
  /** Payout breakdown for the hover-card preview on the Earnings cell. */
  payout?: {
    rental_amount: number;
    payment_fee_rate: number;
    vat_rate: number;
    base_after_fee_and_vat: number;
    commission_percent: number;
    assisted_gross: number;
    total_marketing_fee: number;
    marketing_agent_count: number;
    split_marketing_fee: number;
    assisted_net: number;
  };
};

/** Unified payment row for the outstanding payments tracker */
export type PaymentRow = {
  id: string;
  type: "rental" | "bonus";
  code: string;
  client_name: string;
  agent_name: string;
  agent_id: string;
  marketing_agents?: string[];
  amount: number;
  date: string;
  status: string;
};

/** Trend point with optional per-agent breakdown for Compare Agents chart */
export type EarningsTrendPointWithAgents = EarningsTrendPoint & {
  by_agent?: Record<string, number>;
};

export type EarningsStats = {
  totalAgents: number;
  totalEarnings: number;
  totalTransactions: number;
  totalRentalsClosed?: number;
  avgPerAgent: number;
  topAgentName?: string | null;
  topAgentEarnings?: number | null;
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
  last_activity: string | null;
  commission_percent: number | null;
  rank: number;
};

/** Single closed rental / commission event for export and agent profile */
export type EarningsTransaction = {
  id: string;
  agent_id: string;
  property_id?: string;
  property_name: string;
  tenant_name?: string;
  amount: number;
  rent_amount?: number;
  created_at: string;
};

/** Trend point with optional per-agent breakdown for Compare Agents chart */
export type EarningsTrendPointWithAgents = EarningsTrendPoint & {
  by_agent?: Record<string, number>;
};

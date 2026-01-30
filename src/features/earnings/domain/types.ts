export type EarningsStats = {
  totalAgents: number;
  totalEarnings: number;
  totalTransactions: number;
  avgPerAgent: number;
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

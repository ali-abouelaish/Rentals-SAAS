/**
 * Frontend contracts for "My Profile" /me area.
 * Mock API returns these shapes; swap for real API later.
 */

export type CurrentUser = {
  id: string;
  name: string;
  role: "agent" | "admin";
  avatarUrl?: string;
  email?: string;
  phone?: string;
  joinedAt?: string;
};

export type AgentStats = {
  agentId: string;
  totalEarnings: number;
  totalRentals: number;
  conversionRate?: number;
  avgEarningsPerRental?: number;
  earningsThisPeriod?: number;
  rentalsThisPeriod?: number;
  growthPct?: number;
};

export type MyTransaction = {
  id: string;
  agentId: string;
  propertyName: string;
  tenantName?: string;
  rentAmount?: number;
  amount: number;
  createdAt: string;
};

export type TrendPoint = {
  date: string;
  earnings: number;
  rentals: number;
};

export type MyBonus = {
  id: string;
  agentId: string;
  type: "weekly" | "monthly" | "referral" | "other";
  amount: number;
  createdAt: string;
};

/**
 * Mock API for /me (My Profile). Swap for real API later.
 */
import type { CurrentUser, AgentStats, MyTransaction, TrendPoint, MyBonus } from "./types";

const MOCK_AGENT_ID = "mock-agent-1";

function randomBetween(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return {
    id: MOCK_AGENT_ID,
    name: "Alex Agent",
    role: "agent",
    avatarUrl: undefined,
    email: "alex@agency.example",
    phone: "+44 7700 900123",
    joinedAt: "2024-01-15T00:00:00Z"
  };
}

export async function getMyStats({
  startDate,
  endDate
}: {
  startDate: string;
  endDate: string;
}): Promise<AgentStats> {
  const totalEarnings = 28450;
  const totalRentals = 42;
  const earningsThisPeriod = 3200;
  const rentalsThisPeriod = 5;
  return {
    agentId: MOCK_AGENT_ID,
    totalEarnings,
    totalRentals,
    conversionRate: 0.34,
    avgEarningsPerRental: Math.round(totalEarnings / totalRentals),
    earningsThisPeriod,
    rentalsThisPeriod,
    growthPct: 12.5
  };
}

export async function getMyTrends({
  startDate,
  endDate
}: {
  startDate: string;
  endDate: string;
}): Promise<TrendPoint[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const points: TrendPoint[] = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    points.push({
      date: d.toISOString().slice(0, 10),
      earnings: randomBetween(80, 400),
      rentals: randomBetween(0, 2)
    });
  }
  return points.slice(-60);
}

export async function getMyTransactions({
  startDate,
  endDate,
  search,
  page = 1,
  pageSize = 10
}: {
  startDate: string;
  endDate: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ transactions: MyTransaction[]; total: number }> {
  const all: MyTransaction[] = [
    { id: "1", agentId: MOCK_AGENT_ID, propertyName: "12 Oak Lane", tenantName: "Jane Doe", rentAmount: 1200, amount: 180, createdAt: "2025-02-08T10:00:00Z" },
    { id: "2", agentId: MOCK_AGENT_ID, propertyName: "4 Park Rd", tenantName: "John Smith", rentAmount: 950, amount: 142, createdAt: "2025-02-05T14:00:00Z" },
    { id: "3", agentId: MOCK_AGENT_ID, propertyName: "7 Church St", tenantName: "A. Brown", rentAmount: 1100, amount: 165, createdAt: "2025-02-01T09:00:00Z" }
  ];
  let filtered = all;
  if (search) {
    const q = search.toLowerCase();
    filtered = all.filter((t) => t.propertyName.toLowerCase().includes(q) || (t.tenantName ?? "").toLowerCase().includes(q));
  }
  const total = filtered.length;
  const from = (page - 1) * (pageSize ?? 10);
  const transactions = filtered.slice(from, from + (pageSize ?? 10));
  return { transactions, total };
}

export async function getMyBonuses({
  startDate,
  endDate
}: {
  startDate: string;
  endDate: string;
}): Promise<MyBonus[]> {
  return [
    { id: "b1", agentId: MOCK_AGENT_ID, type: "monthly", amount: 250, createdAt: "2025-02-01T00:00:00Z" },
    { id: "b2", agentId: MOCK_AGENT_ID, type: "referral", amount: 100, createdAt: "2025-01-15T00:00:00Z" }
  ];
}

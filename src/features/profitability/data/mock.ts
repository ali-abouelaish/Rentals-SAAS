/**
 * Realistic mock data for the Profitability module.
 * Used as a fallback when Phase 3 DB migrations have not yet been applied.
 * All monetary amounts in pence unless noted.
 */

import type {
  PropertyProfitability,
  DashboardData,
  ProfitabilityAlert,
  VacancyUnit,
  UpcomingMoveOut,
  PortfolioMonthPoint,
  PropertyCost,
} from "../domain/types";

// ──────────────────────────────────────────────────────────
// Costs
// ──────────────────────────────────────────────────────────

const makeCost = (
  propertyId: string,
  overrides: Partial<PropertyCost>
): PropertyCost => ({
  id: crypto.randomUUID(),
  tenant_id: "mock",
  property_id: propertyId,
  unit_id: null,
  cost_type: "other",
  cost_label: null,
  amount: 0,
  cost_mode: "recurring",
  recurrence_day: 1,
  amortise_months: null,
  amortise_start_date: null,
  purchase_date: null,
  date_incurred: "2026-04-01",
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const prop1Costs: PropertyCost[] = [
  makeCost("prop1", { id: "c1a", cost_type: "owner_rent", amount: 350000, date_incurred: "2025-10-01" }),
  makeCost("prop1", { id: "c1b", cost_type: "council_tax", amount: 18000, date_incurred: "2025-10-01" }),
  makeCost("prop1", { id: "c1c", cost_type: "insurance", amount: 9500, date_incurred: "2025-10-01" }),
  makeCost("prop1", { id: "c1d", cost_type: "cleaning", cost_label: "Fortnightly clean", amount: 24000, date_incurred: "2025-10-01" }),
  makeCost("prop1", { id: "c1e", cost_type: "bills", cost_label: "Broadband", amount: 6000, date_incurred: "2025-10-01" }),
];

const prop2Costs: PropertyCost[] = [
  makeCost("prop2", { id: "c2a", cost_type: "owner_rent", amount: 280000, date_incurred: "2025-07-01" }),
  makeCost("prop2", { id: "c2b", cost_type: "council_tax", amount: 18000, date_incurred: "2025-07-01" }),
  makeCost("prop2", { id: "c2c", cost_type: "insurance", amount: 9000, date_incurred: "2025-07-01" }),
  makeCost("prop2", { id: "c2d", cost_type: "cleaning", amount: 18000, date_incurred: "2025-07-01" }),
  makeCost("prop2", { id: "c2e", cost_type: "bills", cost_label: "Garden maintenance", amount: 8500, date_incurred: "2025-07-01" }),
];

const prop3Costs: PropertyCost[] = [
  makeCost("prop3", { id: "c3a", cost_type: "owner_rent", amount: 210000, date_incurred: "2025-11-01" }),
  makeCost("prop3", { id: "c3b", cost_type: "council_tax", amount: 15000, date_incurred: "2025-11-01" }),
  makeCost("prop3", { id: "c3c", cost_type: "insurance", amount: 7500, date_incurred: "2025-11-01" }),
  makeCost("prop3", { id: "c3d", cost_type: "cleaning", amount: 16000, date_incurred: "2025-11-01" }),
  makeCost("prop3", {
    id: "c3e", cost_type: "maintenance", cost_label: "Emergency boiler repair",
    amount: 180000, cost_mode: "one_off", recurrence_day: null,
    date_incurred: "2026-03-30",
  }),
];

const prop6Costs: PropertyCost[] = [
  makeCost("prop6", { id: "c6a", cost_type: "owner_rent", amount: 380000, date_incurred: "2025-09-01" }),
  makeCost("prop6", { id: "c6b", cost_type: "council_tax", amount: 18000, date_incurred: "2025-09-01" }),
  makeCost("prop6", { id: "c6c", cost_type: "insurance", amount: 11000, date_incurred: "2025-09-01" }),
  makeCost("prop6", { id: "c6d", cost_type: "cleaning", cost_label: "Weekly clean", amount: 25000, date_incurred: "2025-09-01" }),
  makeCost("prop6", { id: "c6e", cost_type: "bills", cost_label: "Broadband & Sky", amount: 8000, date_incurred: "2025-09-01" }),
  makeCost("prop6", {
    id: "c6f", cost_type: "furniture", cost_label: "Living room furniture refresh",
    amount: 350000, cost_mode: "amortised", amortise_months: 24,
    amortise_start_date: "2025-08-01", purchase_date: "2025-07-28",
    date_incurred: "2025-07-28", recurrence_day: null,
  }),
];

// ──────────────────────────────────────────────────────────
// Property Profitabilities
// ──────────────────────────────────────────────────────────

export const MOCK_PROPERTIES: PropertyProfitability[] = [
  {
    property_id: "prop1",
    property_name: "14 Mastmaker Road",
    portfolio_id: "fen",
    portfolio_name: "FENIX",
    portfolio_color: "#0d9488",
    total_units: 6,
    occupied_units: 4,
    total_income: 420000, // 4 rooms × avg £1,050
    total_costs: 407500, // £3,500 owner rent + others
    vacancy_loss: 30000, // Room 4 vacant 9 days × £33/day
    net_profit: -17500, // below target of £800
    target_profit: 80000, // £800 in pence
    vs_target: -97500,
    last_month_net_profit: 42000,
    trend: "down",
    unit_breakdown: [
      { unit_id: "u1a", unit_label: "Room 1 · Double", tenant_name: "Marcus Chen", rent_pcm: 105000, days_vacant: 0, vacancy_loss: 0, net_contribution: 105000, status: "occupied" },
      { unit_id: "u1b", unit_label: "Room 2 · Single", tenant_name: "Priya Sharma", rent_pcm: 80000, days_vacant: 4, vacancy_loss: 10667, net_contribution: 69333, status: "move_out" },
      { unit_id: "u1c", unit_label: "Room 3 · Master", tenant_name: "James O'Brien", rent_pcm: 125000, days_vacant: 0, vacancy_loss: 0, net_contribution: 125000, status: "renewal" },
      { unit_id: "u1d", unit_label: "Room 4 · Double", tenant_name: null, rent_pcm: 0, days_vacant: 9, vacancy_loss: 30000, net_contribution: -30000, status: "available" },
      { unit_id: "u1e", unit_label: "Room 5 · En-suite", tenant_name: "Emma Thompson", rent_pcm: 115000, days_vacant: 0, vacancy_loss: 0, net_contribution: 115000, status: "booked" },
      { unit_id: "u1f", unit_label: "Room 6 · Single", tenant_name: "Sofia Martinez", rent_pcm: 85000, days_vacant: 0, vacancy_loss: 0, net_contribution: 85000, status: "occupied" },
    ],
    costs: prop1Costs,
  },
  {
    property_id: "prop2",
    property_name: "37 Sussex Gardens",
    portfolio_id: "jms",
    portfolio_name: "JMS",
    portfolio_color: "#2563eb",
    total_units: 5,
    occupied_units: 2,
    total_income: 222000, // 2 rooms occupied
    total_costs: 333500,
    vacancy_loss: 83333, // 3 rooms vacant various days
    net_profit: -194833,
    target_profit: 50000,
    vs_target: -244833,
    last_month_net_profit: -152000,
    trend: "down",
    unit_breakdown: [
      { unit_id: "u2a", unit_label: "Room 1 · Master", tenant_name: "Kwame Asante", rent_pcm: 135000, days_vacant: 0, vacancy_loss: 0, net_contribution: 135000, status: "occupied" },
      { unit_id: "u2b", unit_label: "Room 2 · Double", tenant_name: null, rent_pcm: 0, days_vacant: 15, vacancy_loss: 55000, net_contribution: -55000, status: "available" },
      { unit_id: "u2c", unit_label: "Room 3 · Double", tenant_name: null, rent_pcm: 0, days_vacant: 7, vacancy_loss: 25667, net_contribution: -25667, status: "on_hold" },
      { unit_id: "u2d", unit_label: "Room 4 · Single", tenant_name: "Amelia Turner", rent_pcm: 87000, days_vacant: 0, vacancy_loss: 0, net_contribution: 87000, status: "occupied" },
      { unit_id: "u2e", unit_label: "Room 5 · En-suite", tenant_name: null, rent_pcm: 0, days_vacant: 2, vacancy_loss: 8000, net_contribution: -8000, status: "replacement" },
    ],
    costs: prop2Costs,
  },
  {
    property_id: "prop3",
    property_name: "22 Balham High Road",
    portfolio_id: "ss",
    portfolio_name: "Smart Share",
    portfolio_color: "#7c3aed",
    total_units: 4,
    occupied_units: 3,
    total_income: 292500,
    total_costs: 428500, // includes £1,800 boiler repair
    vacancy_loss: 27500, // Room 2 vacant 11 days
    net_profit: -163500,
    target_profit: 60000,
    vs_target: -223500,
    last_month_net_profit: 48000,
    trend: "down",
    unit_breakdown: [
      { unit_id: "u3a", unit_label: "Room 1 · Double", tenant_name: "David Kowalski", rent_pcm: 97500, days_vacant: 0, vacancy_loss: 0, net_contribution: 97500, status: "occupied" },
      { unit_id: "u3b", unit_label: "Room 2 · Single", tenant_name: null, rent_pcm: 0, days_vacant: 11, vacancy_loss: 27500, net_contribution: -27500, status: "available" },
      { unit_id: "u3c", unit_label: "Room 3 · Double", tenant_name: "Daniel Chen", rent_pcm: 97500, days_vacant: 0, vacancy_loss: 0, net_contribution: 97500, status: "occupied" },
      { unit_id: "u3d", unit_label: "Room 4 · Master", tenant_name: "Kevin O'Brien", rent_pcm: 115000, days_vacant: 0, vacancy_loss: 0, net_contribution: 115000, status: "occupied" },
    ],
    costs: prop3Costs,
  },
  {
    property_id: "prop4",
    property_name: "8 Rope Street",
    portfolio_id: "fen",
    portfolio_name: "FENIX",
    portfolio_color: "#0d9488",
    total_units: 1,
    occupied_units: 0,
    total_income: 0,
    total_costs: 145000,
    vacancy_loss: 65000, // 13 days × £50/day
    net_profit: -210000,
    target_profit: 30000,
    vs_target: -240000,
    last_month_net_profit: 25000,
    trend: "down",
    unit_breakdown: [
      { unit_id: "u4a", unit_label: "Studio", tenant_name: null, rent_pcm: 0, days_vacant: 13, vacancy_loss: 65000, net_contribution: -65000, status: "available" },
    ],
    costs: [
      makeCost("prop4", { id: "c4a", cost_type: "owner_rent", amount: 120000, date_incurred: "2025-08-01" }),
      makeCost("prop4", { id: "c4b", cost_type: "council_tax", amount: 14000, date_incurred: "2025-08-01" }),
      makeCost("prop4", { id: "c4c", cost_type: "insurance", amount: 6500, date_incurred: "2025-08-01" }),
      makeCost("prop4", { id: "c4d", cost_type: "bills", cost_label: "Broadband", amount: 4500, date_incurred: "2025-08-01" }),
    ],
  },
  {
    property_id: "prop5",
    property_name: "91 Cambridge Heath Road",
    portfolio_id: "jms",
    portfolio_name: "JMS",
    portfolio_color: "#2563eb",
    total_units: 1,
    occupied_units: 1,
    total_income: 235000,
    total_costs: 209500,
    vacancy_loss: 0,
    net_profit: 25500, // below target of £400
    target_profit: 40000,
    vs_target: -14500,
    last_month_net_profit: 27000,
    trend: "down",
    unit_breakdown: [
      { unit_id: "u5a", unit_label: "Whole Flat", tenant_name: "Aleksandra Kowalski", rent_pcm: 235000, days_vacant: 0, vacancy_loss: 0, net_contribution: 235000, status: "occupied" },
    ],
    costs: [
      makeCost("prop5", { id: "c5a", cost_type: "owner_rent", amount: 180000, date_incurred: "2026-01-01" }),
      makeCost("prop5", { id: "c5b", cost_type: "council_tax", amount: 20000, date_incurred: "2026-01-01" }),
      makeCost("prop5", { id: "c5c", cost_type: "insurance", amount: 9500, date_incurred: "2026-01-01" }),
    ],
  },
  {
    property_id: "prop6",
    property_name: "45 Clapham Common South Side",
    portfolio_id: "fen",
    portfolio_name: "FENIX",
    portfolio_color: "#0d9488",
    total_units: 5,
    occupied_units: 5,
    total_income: 555000,
    total_costs: 456625, // includes amortised furniture (£350k ÷ 24 = £14,583/mo)
    vacancy_loss: 0,
    net_profit: 98375,
    target_profit: 70000,
    vs_target: 28375,
    last_month_net_profit: 93000,
    trend: "up",
    unit_breakdown: [
      { unit_id: "u6a", unit_label: "Room 1 · Master", tenant_name: "Mohammed Al-Rashid", rent_pcm: 125000, days_vacant: 0, vacancy_loss: 0, net_contribution: 125000, status: "occupied" },
      { unit_id: "u6b", unit_label: "Room 2 · Double", tenant_name: "Sophie Laurent", rent_pcm: 105000, days_vacant: 0, vacancy_loss: 0, net_contribution: 105000, status: "occupied" },
      { unit_id: "u6c", unit_label: "Room 3 · En-suite", tenant_name: "Oleksandr Koval", rent_pcm: 125000, days_vacant: 0, vacancy_loss: 0, net_contribution: 125000, status: "occupied" },
      { unit_id: "u6d", unit_label: "Room 4 · Double", tenant_name: "James Whitfield", rent_pcm: 105000, days_vacant: 0, vacancy_loss: 0, net_contribution: 105000, status: "occupied" },
      { unit_id: "u6e", unit_label: "Room 5 · Single", tenant_name: "Priya Sharma", rent_pcm: 95000, days_vacant: 0, vacancy_loss: 0, net_contribution: 95000, status: "occupied" },
    ],
    costs: prop6Costs,
  },
  {
    property_id: "prop7",
    property_name: "12 Brixton Road",
    portfolio_id: "ss",
    portfolio_name: "Smart Share",
    portfolio_color: "#7c3aed",
    total_units: 4,
    occupied_units: 3,
    total_income: 270000,
    total_costs: 259000,
    vacancy_loss: 28000, // Room 4 vacant 17 days
    net_profit: -17000, // below target of £500
    target_profit: 50000,
    vs_target: -67000,
    last_month_net_profit: 31000,
    trend: "down",
    unit_breakdown: [
      { unit_id: "u7a", unit_label: "Room 1 · Double", tenant_name: "Natalia Koval", rent_pcm: 95000, days_vacant: 0, vacancy_loss: 0, net_contribution: 95000, status: "occupied" },
      { unit_id: "u7b", unit_label: "Room 2 · Double", tenant_name: "Rajesh Sharma", rent_pcm: 95000, days_vacant: 0, vacancy_loss: 0, net_contribution: 95000, status: "occupied" },
      { unit_id: "u7c", unit_label: "Room 3 · Single", tenant_name: "Emma Thompson", rent_pcm: 80000, days_vacant: 0, vacancy_loss: 0, net_contribution: 80000, status: "occupied" },
      { unit_id: "u7d", unit_label: "Room 4 · Single", tenant_name: null, rent_pcm: 0, days_vacant: 17, vacancy_loss: 28000, net_contribution: -28000, status: "available" },
    ],
    costs: [
      makeCost("prop7", { id: "c7a", cost_type: "owner_rent", amount: 220000, date_incurred: "2025-09-01" }),
      makeCost("prop7", { id: "c7b", cost_type: "council_tax", amount: 16000, date_incurred: "2025-09-01" }),
      makeCost("prop7", { id: "c7c", cost_type: "insurance", amount: 8000, date_incurred: "2025-09-01" }),
      makeCost("prop7", { id: "c7d", cost_type: "cleaning", amount: 15000, date_incurred: "2025-09-01" }),
    ],
  },
  {
    property_id: "prop8",
    property_name: "3 Shoreditch High Street",
    portfolio_id: "jms",
    portfolio_name: "JMS",
    portfolio_color: "#2563eb",
    total_units: 6,
    occupied_units: 5,
    total_income: 595000,
    total_costs: 482000,
    vacancy_loss: 11333, // Room 6 renewal, minor overlap
    net_profit: 101667,
    target_profit: 90000,
    vs_target: 11667,
    last_month_net_profit: 96000,
    trend: "up",
    unit_breakdown: [
      { unit_id: "u8a", unit_label: "Room 1 · Master", tenant_name: "Daniel Chen", rent_pcm: 135000, days_vacant: 0, vacancy_loss: 0, net_contribution: 135000, status: "occupied" },
      { unit_id: "u8b", unit_label: "Room 2 · En-suite", tenant_name: "Kevin O'Brien", rent_pcm: 125000, days_vacant: 0, vacancy_loss: 0, net_contribution: 125000, status: "occupied" },
      { unit_id: "u8c", unit_label: "Room 3 · Double", tenant_name: "Marcus Chen", rent_pcm: 115000, days_vacant: 0, vacancy_loss: 0, net_contribution: 115000, status: "occupied" },
      { unit_id: "u8d", unit_label: "Room 4 · Double", tenant_name: "Priya Sharma", rent_pcm: 115000, days_vacant: 0, vacancy_loss: 0, net_contribution: 115000, status: "occupied" },
      { unit_id: "u8e", unit_label: "Room 5 · Single", tenant_name: "Sophie Laurent", rent_pcm: 105000, days_vacant: 0, vacancy_loss: 0, net_contribution: 105000, status: "occupied" },
      { unit_id: "u8f", unit_label: "Room 6 · Single", tenant_name: "James O'Brien", rent_pcm: 0, days_vacant: 3, vacancy_loss: 11333, net_contribution: -11333, status: "renewal" },
    ],
    costs: [
      makeCost("prop8", { id: "c8a", cost_type: "owner_rent", amount: 420000, date_incurred: "2025-06-01" }),
      makeCost("prop8", { id: "c8b", cost_type: "council_tax", amount: 20000, date_incurred: "2025-06-01" }),
      makeCost("prop8", { id: "c8c", cost_type: "insurance", amount: 12000, date_incurred: "2025-06-01" }),
      makeCost("prop8", { id: "c8d", cost_type: "cleaning", cost_label: "Weekly professional clean", amount: 30000, date_incurred: "2025-06-01" }),
    ],
  },
  {
    property_id: "prop9",
    property_name: "78 Hackney Road",
    portfolio_id: "fen",
    portfolio_name: "FENIX",
    portfolio_color: "#0d9488",
    total_units: 1,
    occupied_units: 1,
    total_income: 145000, // occupied until notice period
    total_costs: 128500,
    vacancy_loss: 0,
    net_profit: 16500, // below target of £350
    target_profit: 35000,
    vs_target: -18500,
    last_month_net_profit: 21000,
    trend: "down",
    unit_breakdown: [
      { unit_id: "u9a", unit_label: "Studio", tenant_name: "Mohammed Al-Rashid", rent_pcm: 145000, days_vacant: 0, vacancy_loss: 0, net_contribution: 145000, status: "move_out" },
    ],
    costs: [
      makeCost("prop9", { id: "c9a", cost_type: "owner_rent", amount: 105000, date_incurred: "2025-07-01" }),
      makeCost("prop9", { id: "c9b", cost_type: "council_tax", amount: 13000, date_incurred: "2025-07-01" }),
      makeCost("prop9", { id: "c9c", cost_type: "insurance", amount: 6000, date_incurred: "2025-07-01" }),
      makeCost("prop9", { id: "c9d", cost_type: "bills", cost_label: "Broadband", amount: 4500, date_incurred: "2025-07-01" }),
    ],
  },
  {
    property_id: "prop10",
    property_name: "55 Dalston Lane",
    portfolio_id: "ss",
    portfolio_name: "Smart Share",
    portfolio_color: "#7c3aed",
    total_units: 1,
    occupied_units: 1,
    total_income: 195000,
    total_costs: 176500,
    vacancy_loss: 0,
    net_profit: 18500, // below target of £500
    target_profit: 50000,
    vs_target: -31500,
    last_month_net_profit: 23000,
    trend: "down",
    unit_breakdown: [
      { unit_id: "u10a", unit_label: "Whole Flat", tenant_name: "Oleksandr Koval", rent_pcm: 195000, days_vacant: 0, vacancy_loss: 0, net_contribution: 195000, status: "move_out" },
    ],
    costs: [
      makeCost("prop10", { id: "c10a", cost_type: "owner_rent", amount: 140000, date_incurred: "2025-08-01" }),
      makeCost("prop10", { id: "c10b", cost_type: "council_tax", amount: 18000, date_incurred: "2025-08-01" }),
      makeCost("prop10", { id: "c10c", cost_type: "insurance", amount: 8500, date_incurred: "2025-08-01" }),
      makeCost("prop10", { id: "c10d", cost_type: "cleaning", cost_label: "Monthly deep clean", amount: 10000, date_incurred: "2025-08-01" }),
    ],
  },
];

// ──────────────────────────────────────────────────────────
// Alerts
// ──────────────────────────────────────────────────────────

export const MOCK_ALERTS: ProfitabilityAlert[] = [
  {
    id: "al1",
    tenant_id: "mock",
    property_id: "prop2",
    unit_id: null,
    alert_type: "profitability_below_target",
    triggered_at: new Date(Date.now() - 65 * 86400000).toISOString(),
    resolved_at: null,
    is_resolved: false,
    metadata: { months_below: 2, target_pcm: 500, actual_pcm: -985, shortfall: 1485 },
    email_sent: true,
    property_name: "37 Sussex Gardens",
    portfolio_name: "JMS",
    portfolio_color: "#2563eb",
    unit_label: null,
  },
  {
    id: "al2",
    tenant_id: "mock",
    property_id: "prop1",
    unit_id: "u1d",
    alert_type: "vacancy_running",
    triggered_at: new Date(Date.now() - 9 * 86400000).toISOString(),
    resolved_at: null,
    is_resolved: false,
    metadata: { days_vacant: 9, daily_rate: 3333, total_loss: 30000 },
    email_sent: true,
    property_name: "14 Mastmaker Road",
    portfolio_name: "FENIX",
    portfolio_color: "#0d9488",
    unit_label: "Room 4 · Double",
  },
  {
    id: "al3",
    tenant_id: "mock",
    property_id: "prop9",
    unit_id: "u9a",
    alert_type: "vacancy_upcoming",
    triggered_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    resolved_at: null,
    is_resolved: false,
    metadata: { days_until_vacant: 12 },
    email_sent: true,
    property_name: "78 Hackney Road",
    portfolio_name: "FENIX",
    portfolio_color: "#0d9488",
    unit_label: "Studio",
  },
  {
    id: "al4",
    tenant_id: "mock",
    property_id: "prop3",
    unit_id: null,
    alert_type: "cost_spike",
    triggered_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    resolved_at: null,
    is_resolved: false,
    metadata: { cost_type: "maintenance", cost_label: "Emergency boiler repair", amount: 180000, target_pcm: 600 },
    email_sent: true,
    property_name: "22 Balham High Road",
    portfolio_name: "Smart Share",
    portfolio_color: "#7c3aed",
    unit_label: null,
  },
  {
    id: "al5",
    tenant_id: "mock",
    property_id: "prop5",
    unit_id: "u5a",
    alert_type: "deposit_deadline",
    triggered_at: new Date(Date.now() - 23 * 86400000).toISOString(),
    resolved_at: null,
    is_resolved: false,
    metadata: { days_until_deadline: 6, deposit_scheme: "mydeposits" },
    email_sent: true,
    property_name: "91 Cambridge Heath Road",
    portfolio_name: "JMS",
    portfolio_color: "#2563eb",
    unit_label: "Whole Flat",
  },
  {
    id: "al6",
    tenant_id: "mock",
    property_id: "prop1",
    unit_id: null,
    alert_type: "landlord_contract_expiry",
    triggered_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    resolved_at: null,
    is_resolved: false,
    metadata: { days_until_expiry: 45, owner_landlord_name: "Hargreaves Estates Ltd" },
    email_sent: true,
    property_name: "14 Mastmaker Road",
    portfolio_name: "FENIX",
    portfolio_color: "#0d9488",
    unit_label: null,
  },
  {
    id: "al7",
    tenant_id: "mock",
    property_id: "prop10",
    unit_id: "u10a",
    alert_type: "notice_vacate_approaching",
    triggered_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    resolved_at: null,
    is_resolved: false,
    metadata: { days_until_vacate: 10, tenant_name: "Oleksandr Koval" },
    email_sent: true,
    property_name: "55 Dalston Lane",
    portfolio_name: "Smart Share",
    portfolio_color: "#7c3aed",
    unit_label: "Whole Flat",
  },
];

// ──────────────────────────────────────────────────────────
// Vacancy Units
// ──────────────────────────────────────────────────────────

export const MOCK_VACANCY_UNITS: VacancyUnit[] = [
  {
    unit_id: "u1d",
    unit_label: "Room 4 · Double",
    property_id: "prop1",
    property_name: "14 Mastmaker Road",
    portfolio_name: "FENIX",
    portfolio_color: "#0d9488",
    status: "vacant",
    days_vacant: 9,
    days_until_vacant: null,
    daily_loss: 33.33,
    total_loss: 300,
  },
  {
    unit_id: "u2b",
    unit_label: "Room 2 · Double",
    property_id: "prop2",
    property_name: "37 Sussex Gardens",
    portfolio_name: "JMS",
    portfolio_color: "#2563eb",
    status: "vacant",
    days_vacant: 15,
    days_until_vacant: null,
    daily_loss: 36.67,
    total_loss: 550,
  },
  {
    unit_id: "u3b",
    unit_label: "Room 2 · Single",
    property_id: "prop3",
    property_name: "22 Balham High Road",
    portfolio_name: "Smart Share",
    portfolio_color: "#7c3aed",
    status: "vacant",
    days_vacant: 11,
    days_until_vacant: null,
    daily_loss: 25,
    total_loss: 275,
  },
  {
    unit_id: "u4a",
    unit_label: "Studio",
    property_id: "prop4",
    property_name: "8 Rope Street",
    portfolio_name: "FENIX",
    portfolio_color: "#0d9488",
    status: "vacant",
    days_vacant: 13,
    days_until_vacant: null,
    daily_loss: 50,
    total_loss: 650,
  },
  {
    unit_id: "u7d",
    unit_label: "Room 4 · Single",
    property_id: "prop7",
    property_name: "12 Brixton Road",
    portfolio_name: "Smart Share",
    portfolio_color: "#7c3aed",
    status: "vacant",
    days_vacant: 17,
    days_until_vacant: null,
    daily_loss: 28.33,
    total_loss: 481,
  },
  {
    unit_id: "u9a",
    unit_label: "Studio",
    property_id: "prop9",
    property_name: "78 Hackney Road",
    portfolio_name: "FENIX",
    portfolio_color: "#0d9488",
    status: "move_out",
    days_vacant: 0,
    days_until_vacant: 12,
    daily_loss: 50,
    total_loss: 0,
  },
  {
    unit_id: "u10a",
    unit_label: "Whole Flat",
    property_id: "prop10",
    property_name: "55 Dalston Lane",
    portfolio_name: "Smart Share",
    portfolio_color: "#7c3aed",
    status: "move_out",
    days_vacant: 0,
    days_until_vacant: 10,
    daily_loss: 63.33,
    total_loss: 0,
  },
];

// ──────────────────────────────────────────────────────────
// Upcoming Move-Outs (within 30 days)
// ──────────────────────────────────────────────────────────

const today = new Date("2026-04-04");
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r.toISOString().split("T")[0];
};

export const MOCK_UPCOMING_MOVE_OUTS: UpcomingMoveOut[] = [
  {
    unit_id: "u9a",
    unit_label: "Studio",
    property_id: "prop9",
    property_name: "78 Hackney Road",
    tenant_name: "Mohammed Al-Rashid",
    vacate_date: addDays(today, 12),
    days_remaining: 12,
    contract_status: "notice_given",
  },
  {
    unit_id: "u10a",
    unit_label: "Whole Flat",
    property_id: "prop10",
    property_name: "55 Dalston Lane",
    tenant_name: "Oleksandr Koval",
    vacate_date: addDays(today, 10),
    days_remaining: 10,
    contract_status: "notice_given",
  },
  {
    unit_id: "u1b",
    unit_label: "Room 2 · Single",
    property_id: "prop1",
    property_name: "14 Mastmaker Road",
    tenant_name: "Priya Sharma",
    vacate_date: addDays(today, 11),
    days_remaining: 11,
    contract_status: "notice_given",
  },
];

// ──────────────────────────────────────────────────────────
// Portfolio Graph Data (12 months)
// ──────────────────────────────────────────────────────────

const monthLabels = [
  "Apr '25", "May '25", "Jun '25", "Jul '25", "Aug '25", "Sep '25",
  "Oct '25", "Nov '25", "Dec '25", "Jan '26", "Feb '26", "Mar '26",
];

// Realistic monthly net profits per portfolio (slight upward trend with variation)
const fenixData = [620, 580, 710, 695, 740, 780, 650, 820, 890, 760, -85, 200];
const jmsData   = [380, 420, 510, 480, 555, 530, 490, 580, 610, 545, -820, -760];
const ssData    = [220, 265, 310, 290, 330, 370, 415, 390, 450, 480, 540, -160];

export const MOCK_PORTFOLIO_GRAPH: PortfolioMonthPoint[] = monthLabels.map(
  (month, i) => ({
    month,
    FENIX: fenixData[i],
    JMS: jmsData[i],
    "Smart Share": ssData[i],
  })
);

// ──────────────────────────────────────────────────────────
// Dashboard Summary
// ──────────────────────────────────────────────────────────

export const MOCK_DASHBOARD_DATA: DashboardData = {
  total_units: 33,
  occupied_units: 24,
  vacant_units: 5,
  daily_vacancy_loss: 231,
  total_rent_roll: 3854, // £ PCM from occupied units
  alerts: MOCK_ALERTS,
  vacancy_units: MOCK_VACANCY_UNITS,
  upcoming_move_outs: MOCK_UPCOMING_MOVE_OUTS,
  top_properties: [
    MOCK_PROPERTIES[5], // Clapham Common  £983/mo
    MOCK_PROPERTIES[7], // Shoreditch      £1,017/mo
    MOCK_PROPERTIES[4], // Cambridge Heath £255/mo
  ],
  worst_properties: [
    MOCK_PROPERTIES[1], // Sussex Gardens -£1,949/mo
    MOCK_PROPERTIES[2], // Balham         -£1,635/mo (cost spike)
    MOCK_PROPERTIES[3], // Rope Street    -£2,100/mo (vacant)
  ],
  portfolio_net_profit_this_month: -280,
  portfolio_net_profit_last_month: 349,
  maintenance_summary: {
    open_jobs: 5,
    in_progress_jobs: 3,
    critical_jobs: 2,
    resolved_this_month: 2,
    total_cost_this_month: 78000,
  },
};

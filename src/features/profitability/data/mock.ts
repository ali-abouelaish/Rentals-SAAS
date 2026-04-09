/**
 * Mock data for the Profitability module — Horizon Dreams & AP portfolios.
 * Dev-mode fallback when Phase 3 DB migrations have not yet been applied.
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
// Cost factory
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

// ──────────────────────────────────────────────────────────
// Costs — Horizon Dreams
// ──────────────────────────────────────────────────────────

const stMichaelsCosts: PropertyCost[] = [
  makeCost("h_stmichaels", { id: "h1a", cost_type: "owner_rent", amount: 360000, date_incurred: "2025-10-01" }),
  makeCost("h_stmichaels", { id: "h1b", cost_type: "council_tax", amount: 18000, date_incurred: "2025-10-01" }),
  makeCost("h_stmichaels", { id: "h1c", cost_type: "insurance", amount: 9500, date_incurred: "2025-10-01" }),
  makeCost("h_stmichaels", { id: "h1d", cost_type: "cleaning", cost_label: "Fortnightly clean", amount: 20000, date_incurred: "2025-10-01" }),
  makeCost("h_stmichaels", { id: "h1e", cost_type: "bills", cost_label: "Broadband", amount: 8000, date_incurred: "2025-10-01" }),
];

const chargrovesCosts: PropertyCost[] = [
  makeCost("h_chargrove", { id: "h2a", cost_type: "owner_rent", amount: 320000, date_incurred: "2025-09-01" }),
  makeCost("h_chargrove", { id: "h2b", cost_type: "council_tax", amount: 18000, date_incurred: "2025-09-01" }),
  makeCost("h_chargrove", { id: "h2c", cost_type: "insurance", amount: 9500, date_incurred: "2025-09-01" }),
  makeCost("h_chargrove", { id: "h2d", cost_type: "cleaning", amount: 18000, date_incurred: "2025-09-01" }),
  makeCost("h_chargrove", { id: "h2e", cost_type: "bills", cost_label: "Utilities & Broadband", amount: 12000, date_incurred: "2025-09-01" }),
];

const bushRoadCosts: PropertyCost[] = [
  makeCost("h_bush", { id: "h3a", cost_type: "owner_rent", amount: 280000, date_incurred: "2025-11-01" }),
  makeCost("h_bush", { id: "h3b", cost_type: "council_tax", amount: 16000, date_incurred: "2025-11-01" }),
  makeCost("h_bush", { id: "h3c", cost_type: "insurance", amount: 9500, date_incurred: "2025-11-01" }),
  makeCost("h_bush", { id: "h3d", cost_type: "cleaning", amount: 16000, date_incurred: "2025-11-01" }),
];

const boundariesCosts: PropertyCost[] = [
  makeCost("h_boundaries", { id: "h4a", cost_type: "owner_rent", amount: 380000, date_incurred: "2025-08-01" }),
  makeCost("h_boundaries", { id: "h4b", cost_type: "council_tax", amount: 20000, date_incurred: "2025-08-01" }),
  makeCost("h_boundaries", { id: "h4c", cost_type: "insurance", amount: 12000, date_incurred: "2025-08-01" }),
  makeCost("h_boundaries", { id: "h4d", cost_type: "cleaning", cost_label: "Weekly clean", amount: 22000, date_incurred: "2025-08-01" }),
  makeCost("h_boundaries", { id: "h4e", cost_type: "bills", cost_label: "Utilities package", amount: 30000, date_incurred: "2025-08-01" }),
];

const everardCosts: PropertyCost[] = [
  makeCost("h_everard", { id: "h5a", cost_type: "owner_rent", amount: 250000, date_incurred: "2026-01-01" }),
  makeCost("h_everard", { id: "h5b", cost_type: "council_tax", amount: 15000, date_incurred: "2026-01-01" }),
  makeCost("h_everard", { id: "h5c", cost_type: "insurance", amount: 8500, date_incurred: "2026-01-01" }),
  makeCost("h_everard", { id: "h5d", cost_type: "cleaning", amount: 16000, date_incurred: "2026-01-01" }),
  makeCost("h_everard", {
    id: "h5e",
    cost_type: "maintenance",
    cost_label: "Communal area repaint",
    amount: 95000,
    cost_mode: "one_off",
    recurrence_day: null,
    date_incurred: "2026-04-02",
  }),
];

const parkWestCosts: PropertyCost[] = [
  makeCost("h_parkwest", { id: "h6a", cost_type: "owner_rent", amount: 240000, date_incurred: "2025-12-01" }),
  makeCost("h_parkwest", { id: "h6b", cost_type: "council_tax", amount: 18000, date_incurred: "2025-12-01" }),
  makeCost("h_parkwest", { id: "h6c", cost_type: "insurance", amount: 11000, date_incurred: "2025-12-01" }),
  makeCost("h_parkwest", { id: "h6d", cost_type: "cleaning", cost_label: "Professional clean", amount: 16000, date_incurred: "2025-12-01" }),
  makeCost("h_parkwest", {
    id: "h6e",
    cost_type: "furniture",
    cost_label: "Bedroom furniture upgrade",
    amount: 280000,
    cost_mode: "amortised",
    amortise_months: 18,
    amortise_start_date: "2026-01-01",
    purchase_date: "2025-12-20",
    date_incurred: "2025-12-20",
    recurrence_day: null,
  }),
];

// ──────────────────────────────────────────────────────────
// Costs — AP
// ──────────────────────────────────────────────────────────

const apVictoriaCosts: PropertyCost[] = [
  makeCost("ap_victoria", { id: "a1a", cost_type: "owner_rent", amount: 310000, date_incurred: "2025-07-01" }),
  makeCost("ap_victoria", { id: "a1b", cost_type: "council_tax", amount: 17000, date_incurred: "2025-07-01" }),
  makeCost("ap_victoria", { id: "a1c", cost_type: "insurance", amount: 9000, date_incurred: "2025-07-01" }),
  makeCost("ap_victoria", { id: "a1d", cost_type: "cleaning", cost_label: "Fortnightly clean", amount: 19000, date_incurred: "2025-07-01" }),
  makeCost("ap_victoria", { id: "a1e", cost_type: "bills", cost_label: "Broadband", amount: 6000, date_incurred: "2025-07-01" }),
];

const apFinsburyCosts: PropertyCost[] = [
  makeCost("ap_finsbury", { id: "a2a", cost_type: "owner_rent", amount: 275000, date_incurred: "2025-06-01" }),
  makeCost("ap_finsbury", { id: "a2b", cost_type: "council_tax", amount: 16000, date_incurred: "2025-06-01" }),
  makeCost("ap_finsbury", { id: "a2c", cost_type: "insurance", amount: 8500, date_incurred: "2025-06-01" }),
  makeCost("ap_finsbury", { id: "a2d", cost_type: "cleaning", amount: 17000, date_incurred: "2025-06-01" }),
];

const apCamdenCosts: PropertyCost[] = [
  makeCost("ap_camden", { id: "a3a", cost_type: "owner_rent", amount: 340000, date_incurred: "2025-10-01" }),
  makeCost("ap_camden", { id: "a3b", cost_type: "council_tax", amount: 19000, date_incurred: "2025-10-01" }),
  makeCost("ap_camden", { id: "a3c", cost_type: "insurance", amount: 10000, date_incurred: "2025-10-01" }),
  makeCost("ap_camden", { id: "a3d", cost_type: "cleaning", cost_label: "Weekly clean", amount: 24000, date_incurred: "2025-10-01" }),
  makeCost("ap_camden", { id: "a3e", cost_type: "bills", cost_label: "Broadband & Sky", amount: 7500, date_incurred: "2025-10-01" }),
];

const apWappingCosts: PropertyCost[] = [
  makeCost("ap_wapping", { id: "a4a", cost_type: "owner_rent", amount: 260000, date_incurred: "2025-09-01" }),
  makeCost("ap_wapping", { id: "a4b", cost_type: "council_tax", amount: 16500, date_incurred: "2025-09-01" }),
  makeCost("ap_wapping", { id: "a4c", cost_type: "insurance", amount: 8000, date_incurred: "2025-09-01" }),
  makeCost("ap_wapping", { id: "a4d", cost_type: "cleaning", amount: 16000, date_incurred: "2025-09-01" }),
  makeCost("ap_wapping", {
    id: "a4e",
    cost_type: "maintenance",
    cost_label: "Bathroom refurbishment",
    amount: 220000,
    cost_mode: "one_off",
    recurrence_day: null,
    date_incurred: "2026-04-05",
  }),
];

// ──────────────────────────────────────────────────────────
// Property Profitabilities
// ──────────────────────────────────────────────────────────

export const MOCK_PROPERTIES: PropertyProfitability[] = [
  // ── HORIZON DREAMS ──────────────────────────────────────
  // [0] All occupied — best Horizon performer
  {
    property_id: "h_stmichaels",
    property_name: "81 St Michael's Street",
    portfolio_id: "horizon",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    total_units: 4,
    occupied_units: 4,
    total_income: 548000,   // 1300+1280+1250+1650
    total_costs: 415500,
    vacancy_loss: 0,
    net_profit: 132500,     // £1,325/mo
    target_profit: 100000,
    vs_target: 32500,
    last_month_net_profit: 115000,
    trend: "up",
    unit_breakdown: [
      { unit_id: "h1_C",    unit_label: "Room C · Double",   tenant_name: "Michael Briggs",  rent_pcm: 130000, days_vacant: 0, vacancy_loss: 0, net_contribution: 130000, status: "move_out" },
      { unit_id: "h1_D",    unit_label: "Room D · Double",   tenant_name: "Sotiria Zve",     rent_pcm: 128000, days_vacant: 0, vacancy_loss: 0, net_contribution: 128000, status: "occupied" },
      { unit_id: "h1_B",    unit_label: "Room B · Double",   tenant_name: "Songying Liu",    rent_pcm: 125000, days_vacant: 0, vacancy_loss: 0, net_contribution: 125000, status: "occupied" },
      { unit_id: "h1_ENSA", unit_label: "Room A · En-suite", tenant_name: "Sohini Mallick",  rent_pcm: 165000, days_vacant: 0, vacancy_loss: 0, net_contribution: 165000, status: "occupied" },
    ],
    costs: stMichaelsCosts,
  },
  // [1] 2 vacancies — below target
  {
    property_id: "h_chargrove",
    property_name: "7 Chargrove Close",
    portfolio_id: "horizon",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    total_units: 5,
    occupied_units: 3,
    total_income: 347500,   // Sean 1400 + Zunaid 1075 + Michelle 1000
    total_costs: 377500,
    vacancy_loss: 50500,    // ENS2 8d (34,667) + D1 5d (15,833)
    net_profit: -80500,     // -£805/mo
    target_profit: 80000,
    vs_target: -160500,
    last_month_net_profit: 28000,
    trend: "down",
    unit_breakdown: [
      { unit_id: "h2_ENS5", unit_label: "Room 5 · En-suite", tenant_name: "Sean Hamill",     rent_pcm: 140000, days_vacant: 0, vacancy_loss: 0,     net_contribution: 140000,  status: "move_out" },
      { unit_id: "h2_ENS2", unit_label: "Room 2 · En-suite", tenant_name: null,              rent_pcm: 0,      days_vacant: 8, vacancy_loss: 34667, net_contribution: -34667,  status: "available" },
      { unit_id: "h2_D4",   unit_label: "Room 4 · Double",   tenant_name: "Zunaid Rafique",  rent_pcm: 107500, days_vacant: 0, vacancy_loss: 0,     net_contribution: 107500,  status: "occupied" },
      { unit_id: "h2_D3",   unit_label: "Room 3 · Double",   tenant_name: "Jerlin Immanuel", rent_pcm: 100000, days_vacant: 0, vacancy_loss: 0,     net_contribution: 100000,  status: "occupied" },
      { unit_id: "h2_D1",   unit_label: "Room 1 · Double",   tenant_name: null,              rent_pcm: 0,      days_vacant: 5, vacancy_loss: 15833, net_contribution: -15833,  status: "available" },
    ],
    costs: chargrovesCosts,
  },
  // [2] 1 vacancy — just below target
  {
    property_id: "h_bush",
    property_name: "9 Bush Road",
    portfolio_id: "horizon",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    total_units: 5,
    occupied_units: 4,
    total_income: 436500,   // Riddhima 1240 + Abi 1000 + Mudit 950 + Kretika 1175
    total_costs: 321500,
    vacancy_loss: 38600,    // D2 (965) 12 days
    net_profit: 76400,      // £764/mo — just below £800 target
    target_profit: 80000,
    vs_target: -3600,
    last_month_net_profit: 85000,
    trend: "down",
    unit_breakdown: [
      { unit_id: "h3_ENS5", unit_label: "Room 5 · En-suite", tenant_name: "Riddhima Duggal",  rent_pcm: 124000, days_vacant: 0,  vacancy_loss: 0,     net_contribution: 124000,  status: "renewal" },
      { unit_id: "h3_D2",   unit_label: "Room 2 · Double",   tenant_name: null,               rent_pcm: 0,      days_vacant: 12, vacancy_loss: 38600, net_contribution: -38600,  status: "available" },
      { unit_id: "h3_D1",   unit_label: "Room 1 · Double",   tenant_name: "Abi Malster",      rent_pcm: 100000, days_vacant: 0,  vacancy_loss: 0,     net_contribution: 100000,  status: "booked" },
      { unit_id: "h3_D4",   unit_label: "Room 4 · Double",   tenant_name: "Mudit Maheshwari", rent_pcm: 95000,  days_vacant: 0,  vacancy_loss: 0,     net_contribution: 95000,   status: "occupied" },
      { unit_id: "h3_ENS3", unit_label: "Room 3 · En-suite", tenant_name: "Kretika Arora",    rent_pcm: 117500, days_vacant: 0,  vacancy_loss: 0,     net_contribution: 117500,  status: "occupied" },
    ],
    costs: bushRoadCosts,
  },
  // [3] 5/6 occupied — modest profit
  {
    property_id: "h_boundaries",
    property_name: "129 Boundaries Road",
    portfolio_id: "horizon",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    total_units: 6,
    occupied_units: 5,
    total_income: 517000,   // 1025+975+1050+1030+1090
    total_costs: 464000,
    vacancy_loss: 25333,    // D4 (950) 8 days
    net_profit: 27667,      // £277/mo
    target_profit: 100000,
    vs_target: -72333,
    last_month_net_profit: 45000,
    trend: "down",
    unit_breakdown: [
      { unit_id: "h4_D3", unit_label: "Room 3 · Double", tenant_name: "Maisie Boardman",    rent_pcm: 102500, days_vacant: 0, vacancy_loss: 0,     net_contribution: 102500,  status: "occupied" },
      { unit_id: "h4_D2", unit_label: "Room 2 · Double", tenant_name: "Batuhan",            rent_pcm: 97500,  days_vacant: 0, vacancy_loss: 0,     net_contribution: 97500,   status: "occupied" },
      { unit_id: "h4_D1", unit_label: "Room 1 · Double", tenant_name: "David Knox",         rent_pcm: 105000, days_vacant: 0, vacancy_loss: 0,     net_contribution: 105000,  status: "occupied" },
      { unit_id: "h4_D6", unit_label: "Room 6 · Double", tenant_name: "Grace Plummer",      rent_pcm: 103000, days_vacant: 0, vacancy_loss: 0,     net_contribution: 103000,  status: "occupied" },
      { unit_id: "h4_M5", unit_label: "Room 5 · Master", tenant_name: "Georgios Pekaridis", rent_pcm: 109000, days_vacant: 0, vacancy_loss: 0,     net_contribution: 109000,  status: "occupied" },
      { unit_id: "h4_D4", unit_label: "Room 4 · Double", tenant_name: null,                 rent_pcm: 0,      days_vacant: 8, vacancy_loss: 25333, net_contribution: -25333,  status: "available" },
    ],
    costs: boundariesCosts,
  },
  // [4] 3/4 occupied + one-off maintenance cost spike
  {
    property_id: "h_everard",
    property_name: "15 Everard House",
    portfolio_id: "horizon",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    total_units: 4,
    occupied_units: 3,
    total_income: 286000,   // Diya 950 + Hamza 870 + Sofiia 1040
    total_costs: 384500,    // recurring + £950 communal repaint (one-off)
    vacancy_loss: 24000,    // M4 (1200) 6 days
    net_profit: -122500,    // -£1,225/mo
    target_profit: 60000,
    vs_target: -182500,
    last_month_net_profit: 42000,
    trend: "down",
    unit_breakdown: [
      { unit_id: "h5_D1", unit_label: "Room 1 · Double", tenant_name: "Diya Raja",            rent_pcm: 95000,  days_vacant: 0, vacancy_loss: 0,     net_contribution: 95000,   status: "occupied" },
      { unit_id: "h5_M4", unit_label: "Room 4 · Master", tenant_name: null,                   rent_pcm: 0,      days_vacant: 6, vacancy_loss: 24000, net_contribution: -24000,  status: "available" },
      { unit_id: "h5_D3", unit_label: "Room 3 · Double", tenant_name: "Hamza Ahmed",          rent_pcm: 87000,  days_vacant: 0, vacancy_loss: 0,     net_contribution: 87000,   status: "occupied" },
      { unit_id: "h5_D2", unit_label: "Room 2 · Double", tenant_name: "Sofiia Alieksieienko", rent_pcm: 104000, days_vacant: 0, vacancy_loss: 0,     net_contribution: 104000,  status: "occupied" },
    ],
    costs: everardCosts,
  },
  // [5] 1/3 occupied — 2 rooms between tenants (booked, arriving end of month)
  {
    property_id: "h_parkwest",
    property_name: "20 Park West",
    portfolio_id: "horizon",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    total_units: 3,
    occupied_units: 1,
    total_income: 147500,   // Louis only
    total_costs: 300556,    // recurring + amortised furniture (£280k ÷ 18 = £15,556/mo)
    vacancy_loss: 112083,   // D2 10d (38,333) + M1 15d (73,750)
    net_profit: -265139,    // -£2,651/mo
    target_profit: 80000,
    vs_target: -345139,
    last_month_net_profit: 62000,
    trend: "down",
    unit_breakdown: [
      { unit_id: "h6_M3", unit_label: "Room 3 · Master", tenant_name: "Louis Renelier",    rent_pcm: 147500, days_vacant: 0,  vacancy_loss: 0,     net_contribution: 147500,  status: "occupied" },
      { unit_id: "h6_D2", unit_label: "Room 2 · Double", tenant_name: "Edouard de Pouilly", rent_pcm: 115000, days_vacant: 10, vacancy_loss: 38333, net_contribution: -38333, status: "replacement" },
      { unit_id: "h6_M1", unit_label: "Room 1 · Master", tenant_name: "Marie Croppi",      rent_pcm: 147500, days_vacant: 15, vacancy_loss: 73750, net_contribution: -73750, status: "replacement" },
    ],
    costs: parkWestCosts,
  },

  // ── AP ──────────────────────────────────────────────────
  // [6] Fully occupied — best AP performer
  {
    property_id: "ap_victoria",
    property_name: "14 Victoria Road",
    portfolio_id: "ap",
    portfolio_name: "AP",
    portfolio_color: "#f59e0b",
    total_units: 4,
    occupied_units: 4,
    total_income: 432000,   // 1250+1050+1050+970
    total_costs: 361000,
    vacancy_loss: 0,
    net_profit: 71000,      // £710/mo
    target_profit: 60000,
    vs_target: 11000,
    last_month_net_profit: 68000,
    trend: "up",
    unit_breakdown: [
      { unit_id: "a1_M",  unit_label: "Room 1 · Master", tenant_name: "Ayesha Rahman",    rent_pcm: 125000, days_vacant: 0, vacancy_loss: 0, net_contribution: 125000, status: "occupied" },
      { unit_id: "a1_D1", unit_label: "Room 2 · Double", tenant_name: "Tom Gallagher",    rent_pcm: 105000, days_vacant: 0, vacancy_loss: 0, net_contribution: 105000, status: "occupied" },
      { unit_id: "a1_D2", unit_label: "Room 3 · Double", tenant_name: "Niamh O'Sullivan", rent_pcm: 105000, days_vacant: 0, vacancy_loss: 0, net_contribution: 105000, status: "occupied" },
      { unit_id: "a1_S",  unit_label: "Room 4 · Single", tenant_name: "Dmitri Volkov",    rent_pcm: 97000,  days_vacant: 0, vacancy_loss: 0, net_contribution: 97000,  status: "occupied" },
    ],
    costs: apVictoriaCosts,
  },
  // [7] Fully occupied — meets target
  {
    property_id: "ap_finsbury",
    property_name: "22 Finsbury Square",
    portfolio_id: "ap",
    portfolio_name: "AP",
    portfolio_color: "#f59e0b",
    total_units: 3,
    occupied_units: 3,
    total_income: 357000,   // 1350+1150+1070
    total_costs: 316500,
    vacancy_loss: 0,
    net_profit: 40500,      // £405/mo
    target_profit: 40000,
    vs_target: 500,
    last_month_net_profit: 43000,
    trend: "flat",
    unit_breakdown: [
      { unit_id: "a2_M",  unit_label: "Room 1 · Master", tenant_name: "Carlos Mendez", rent_pcm: 135000, days_vacant: 0, vacancy_loss: 0, net_contribution: 135000, status: "occupied" },
      { unit_id: "a2_D1", unit_label: "Room 2 · Double", tenant_name: "Elena Pavlova", rent_pcm: 115000, days_vacant: 0, vacancy_loss: 0, net_contribution: 115000, status: "occupied" },
      { unit_id: "a2_D2", unit_label: "Room 3 · Double", tenant_name: "Wei Zhang",     rent_pcm: 107000, days_vacant: 0, vacancy_loss: 0, net_contribution: 107000, status: "occupied" },
    ],
    costs: apFinsburyCosts,
  },
  // [8] Fully occupied — top performer across both portfolios
  {
    property_id: "ap_camden",
    property_name: "5 Camden High Street",
    portfolio_id: "ap",
    portfolio_name: "AP",
    portfolio_color: "#f59e0b",
    total_units: 5,
    occupied_units: 5,
    total_income: 560000,   // 1300+1250+1100+1100+850
    total_costs: 400500,
    vacancy_loss: 0,
    net_profit: 159500,     // £1,595/mo
    target_profit: 130000,
    vs_target: 29500,
    last_month_net_profit: 152000,
    trend: "up",
    unit_breakdown: [
      { unit_id: "a3_ENS1", unit_label: "Room 1 · En-suite", tenant_name: "Fatima Al-Amin",  rent_pcm: 130000, days_vacant: 0, vacancy_loss: 0, net_contribution: 130000, status: "occupied" },
      { unit_id: "a3_ENS2", unit_label: "Room 2 · En-suite", tenant_name: "Jack Donoghue",   rent_pcm: 125000, days_vacant: 0, vacancy_loss: 0, net_contribution: 125000, status: "occupied" },
      { unit_id: "a3_D1",   unit_label: "Room 3 · Double",   tenant_name: "Yuki Tanaka",     rent_pcm: 110000, days_vacant: 0, vacancy_loss: 0, net_contribution: 110000, status: "occupied" },
      { unit_id: "a3_D2",   unit_label: "Room 4 · Double",   tenant_name: "Olumide Adebayo", rent_pcm: 110000, days_vacant: 0, vacancy_loss: 0, net_contribution: 110000, status: "occupied" },
      { unit_id: "a3_S",    unit_label: "Room 5 · Single",   tenant_name: "Clara Fischer",   rent_pcm: 85000,  days_vacant: 0, vacancy_loss: 0, net_contribution: 85000,  status: "occupied" },
    ],
    costs: apCamdenCosts,
  },
  // [9] 3/4 occupied + large one-off bathroom refurb
  {
    property_id: "ap_wapping",
    property_name: "8 Wapping High Street",
    portfolio_id: "ap",
    portfolio_name: "AP",
    portfolio_color: "#f59e0b",
    total_units: 4,
    occupied_units: 3,
    total_income: 315000,   // Master 1150 + Double2 1050 + Single 950
    total_costs: 520500,    // recurring + £2,200 bathroom refurb (one-off)
    vacancy_loss: 16000,    // Double1 (800) 6 days
    net_profit: -221500,    // -£2,215/mo
    target_profit: 50000,
    vs_target: -271500,
    last_month_net_profit: 45000,
    trend: "down",
    unit_breakdown: [
      { unit_id: "a4_M",  unit_label: "Room 1 · Master", tenant_name: "Nadia Osei",    rent_pcm: 115000, days_vacant: 0, vacancy_loss: 0,     net_contribution: 115000,  status: "occupied" },
      { unit_id: "a4_D1", unit_label: "Room 2 · Double", tenant_name: null,             rent_pcm: 0,      days_vacant: 6, vacancy_loss: 16000, net_contribution: -16000,  status: "available" },
      { unit_id: "a4_D2", unit_label: "Room 3 · Double", tenant_name: "Kieran Murphy",  rent_pcm: 105000, days_vacant: 0, vacancy_loss: 0,     net_contribution: 105000,  status: "occupied" },
      { unit_id: "a4_S",  unit_label: "Room 4 · Single", tenant_name: "Petra Novak",    rent_pcm: 95000,  days_vacant: 0, vacancy_loss: 0,     net_contribution: 95000,   status: "occupied" },
    ],
    costs: apWappingCosts,
  },
];

// ──────────────────────────────────────────────────────────
// Alerts
// ──────────────────────────────────────────────────────────

export const MOCK_ALERTS: ProfitabilityAlert[] = [
  {
    id: "al1",
    tenant_id: "mock",
    property_id: "h_chargrove",
    unit_id: "h2_ENS2",
    alert_type: "vacancy_running",
    triggered_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    resolved_at: null,
    is_resolved: false,
    metadata: { days_vacant: 8, daily_rate: 4333, total_loss: 34667 },
    email_sent: true,
    property_name: "7 Chargrove Close",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    unit_label: "Room 2 · En-suite",
  },
  {
    id: "al2",
    tenant_id: "mock",
    property_id: "h_parkwest",
    unit_id: null,
    alert_type: "profitability_below_target",
    triggered_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    resolved_at: null,
    is_resolved: false,
    metadata: { months_below: 2, target_pcm: 800, actual_pcm: -2651, shortfall: 3451 },
    email_sent: true,
    property_name: "20 Park West",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    unit_label: null,
  },
  {
    id: "al3",
    tenant_id: "mock",
    property_id: "h_everard",
    unit_id: null,
    alert_type: "cost_spike",
    triggered_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    resolved_at: null,
    is_resolved: false,
    metadata: { cost_type: "maintenance", cost_label: "Communal area repaint", amount: 95000, threshold_pct: 40 },
    email_sent: true,
    property_name: "15 Everard House",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    unit_label: null,
  },
  {
    id: "al4",
    tenant_id: "mock",
    property_id: "ap_wapping",
    unit_id: null,
    alert_type: "cost_spike",
    triggered_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    resolved_at: null,
    is_resolved: false,
    metadata: { cost_type: "maintenance", cost_label: "Bathroom refurbishment", amount: 220000, threshold_pct: 85 },
    email_sent: true,
    property_name: "8 Wapping High Street",
    portfolio_name: "AP",
    portfolio_color: "#f59e0b",
    unit_label: null,
  },
  {
    id: "al5",
    tenant_id: "mock",
    property_id: "h_stmichaels",
    unit_id: "h1_C",
    alert_type: "notice_vacate_approaching",
    triggered_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    resolved_at: null,
    is_resolved: false,
    metadata: { days_until_vacate: 22, tenant_name: "Michael Briggs" },
    email_sent: true,
    property_name: "81 St Michael's Street",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    unit_label: "Room C · Double",
  },
  {
    id: "al6",
    tenant_id: "mock",
    property_id: "h_chargrove",
    unit_id: "h2_ENS5",
    alert_type: "notice_vacate_approaching",
    triggered_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    resolved_at: null,
    is_resolved: false,
    metadata: { days_until_vacate: 22, tenant_name: "Sean Hamill" },
    email_sent: true,
    property_name: "7 Chargrove Close",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    unit_label: "Room 5 · En-suite",
  },
];

// ──────────────────────────────────────────────────────────
// Vacancy Units
// ──────────────────────────────────────────────────────────

export const MOCK_VACANCY_UNITS: VacancyUnit[] = [
  {
    unit_id: "h2_ENS2",
    unit_label: "Room 2 · En-suite",
    property_id: "h_chargrove",
    property_name: "7 Chargrove Close",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    status: "vacant",
    days_vacant: 8,
    days_until_vacant: null,
    daily_loss: 43.33,
    total_loss: 347,
  },
  {
    unit_id: "h2_D1",
    unit_label: "Room 1 · Double",
    property_id: "h_chargrove",
    property_name: "7 Chargrove Close",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    status: "vacant",
    days_vacant: 5,
    days_until_vacant: null,
    daily_loss: 31.67,
    total_loss: 158,
  },
  {
    unit_id: "h3_D2",
    unit_label: "Room 2 · Double",
    property_id: "h_bush",
    property_name: "9 Bush Road",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    status: "vacant",
    days_vacant: 12,
    days_until_vacant: null,
    daily_loss: 32.17,
    total_loss: 386,
  },
  {
    unit_id: "h4_D4",
    unit_label: "Room 4 · Double",
    property_id: "h_boundaries",
    property_name: "129 Boundaries Road",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    status: "vacant",
    days_vacant: 8,
    days_until_vacant: null,
    daily_loss: 31.67,
    total_loss: 253,
  },
  {
    unit_id: "h5_M4",
    unit_label: "Room 4 · Master",
    property_id: "h_everard",
    property_name: "15 Everard House",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    status: "vacant",
    days_vacant: 6,
    days_until_vacant: null,
    daily_loss: 40.00,
    total_loss: 240,
  },
  {
    unit_id: "h6_D2",
    unit_label: "Room 2 · Double",
    property_id: "h_parkwest",
    property_name: "20 Park West",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    status: "replacement",
    days_vacant: 10,
    days_until_vacant: null,
    daily_loss: 38.33,
    total_loss: 383,
  },
  {
    unit_id: "h6_M1",
    unit_label: "Room 1 · Master",
    property_id: "h_parkwest",
    property_name: "20 Park West",
    portfolio_name: "Horizon",
    portfolio_color: "#0ea5e9",
    status: "replacement",
    days_vacant: 15,
    days_until_vacant: null,
    daily_loss: 49.17,
    total_loss: 738,
  },
  {
    unit_id: "a4_D1",
    unit_label: "Room 2 · Double",
    property_id: "ap_wapping",
    property_name: "8 Wapping High Street",
    portfolio_name: "AP",
    portfolio_color: "#f59e0b",
    status: "vacant",
    days_vacant: 6,
    days_until_vacant: null,
    daily_loss: 26.67,
    total_loss: 160,
  },
];

// ──────────────────────────────────────────────────────────
// Upcoming Move-Outs (within 30 days)
// ──────────────────────────────────────────────────────────

const today = new Date("2026-04-08");
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r.toISOString().split("T")[0];
};

export const MOCK_UPCOMING_MOVE_OUTS: UpcomingMoveOut[] = [
  {
    unit_id: "h1_C",
    unit_label: "Room C · Double",
    property_id: "h_stmichaels",
    property_name: "81 St Michael's Street",
    tenant_name: "Michael Briggs",
    vacate_date: addDays(today, 22), // 2026-04-30
    days_remaining: 22,
    contract_status: "notice_given",
  },
  {
    unit_id: "h2_ENS5",
    unit_label: "Room 5 · En-suite",
    property_id: "h_chargrove",
    property_name: "7 Chargrove Close",
    tenant_name: "Sean Hamill",
    vacate_date: addDays(today, 22), // 2026-04-30
    days_remaining: 22,
    contract_status: "notice_given",
  },
  {
    unit_id: "h3_D2",
    unit_label: "Room 2 · Double",
    property_id: "h_bush",
    property_name: "9 Bush Road",
    tenant_name: "Saksham Dhingra",
    vacate_date: addDays(today, 22), // 2026-04-30 contract end (already vacated early)
    days_remaining: 22,
    contract_status: "vacated_early",
  },
];

// ──────────────────────────────────────────────────────────
// Portfolio Graph Data (12 months — Apr '25 to Mar '26)
// ──────────────────────────────────────────────────────────

const monthLabels = [
  "Apr '25", "May '25", "Jun '25", "Jul '25", "Aug '25", "Sep '25",
  "Oct '25", "Nov '25", "Dec '25", "Jan '26", "Feb '26", "Mar '26",
];

// Horizon: strong summer, dip in Feb-Mar due to maintenance + Park West vacancies
const horizonData = [3800, 3600, 4100, 3900, 4300, 4500, 4600, 4400, 4800, 4200, 2100, 1900];
// AP: steady growth, Feb dip from Wapping bathroom refurb, recovers in Mar
const apData     = [2800, 3000, 3100, 3300, 3200, 3500, 3700, 3600, 3900, 3800, 1800, 3100];

export const MOCK_PORTFOLIO_GRAPH: PortfolioMonthPoint[] = monthLabels.map((month, i) => ({
  month,
  Horizon: horizonData[i],
  AP: apData[i],
}));

// ──────────────────────────────────────────────────────────
// Dashboard Summary
// ──────────────────────────────────────────────────────────

export const MOCK_DASHBOARD_DATA: DashboardData = {
  total_units: 43,          // Horizon: 4+5+5+6+4+3=27 | AP: 4+3+5+4=16
  occupied_units: 35,       // Horizon: 4+3+4+5+3+1=20 | AP: 4+3+5+3=15
  vacant_units: 8,
  daily_vacancy_loss: 293,  // £/day across all 8 vacancies
  total_rent_roll: 39465,   // £ PCM (Horizon: £22,825 | AP: £16,640)
  alerts: MOCK_ALERTS,
  vacancy_units: MOCK_VACANCY_UNITS,
  upcoming_move_outs: MOCK_UPCOMING_MOVE_OUTS,
  top_properties: [
    MOCK_PROPERTIES[8],   // 5 Camden High Street  +£1,595
    MOCK_PROPERTIES[0],   // 81 St Michael's Street +£1,325
    MOCK_PROPERTIES[6],   // 14 Victoria Road       +£710
  ],
  worst_properties: [
    MOCK_PROPERTIES[5],   // 20 Park West           -£2,651
    MOCK_PROPERTIES[9],   // 8 Wapping High Street  -£2,215
    MOCK_PROPERTIES[4],   // 15 Everard House       -£1,225
  ],
  portfolio_net_profit_this_month: -1821, // Horizon: -£2,316 | AP: +£495
  portfolio_net_profit_last_month: 6850,  // Horizon: +£3,770 | AP: +£3,080
  maintenance_summary: {
    open_jobs: 4,
    in_progress_jobs: 2,
    critical_jobs: 1,
    resolved_this_month: 3,
    total_cost_this_month: 315000, // Everard repaint (£950) + Wapping bathroom (£2,200)
  },
};

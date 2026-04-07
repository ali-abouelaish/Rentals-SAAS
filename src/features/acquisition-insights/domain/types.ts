import { z } from "zod";

// ──────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────

export type EvaluationStatus = "considering" | "taken_on" | "passed";
export type PropertyType = "hmo" | "studio" | "whole_flat";
export type RoomType = "single" | "double" | "master" | "ensuite";

export const LONDON_AREAS = [
  "Barking",
  "Battersea",
  "Bermondsey",
  "Bethnal Green",
  "Borough",
  "Bow",
  "Brixton",
  "Camberwell",
  "Camden",
  "Canary Wharf",
  "Chiswick",
  "Clapham",
  "Clapton",
  "Croydon",
  "Dalston",
  "Docklands",
  "Ealing",
  "Elephant & Castle",
  "Enfield",
  "Finsbury Park",
  "Forest Gate",
  "Fulham",
  "Greenwich",
  "Hackney",
  "Hammersmith",
  "Harrow",
  "Ilford",
  "Isle of Dogs",
  "Islington",
  "Kennington",
  "Kingston",
  "Leyton",
  "Lewisham",
  "Mayfair",
  "Marylebone",
  "Mile End",
  "Nine Elms",
  "Notting Hill",
  "Paddington",
  "Peckham",
  "Poplar",
  "Romford",
  "Shepherds Bush",
  "Shoreditch",
  "Stepney",
  "Stockwell",
  "Stoke Newington",
  "Stratford",
  "Streatham",
  "Tooting",
  "Tottenham",
  "Twickenham",
  "Vauxhall",
  "Walthamstow",
  "Wembley",
  "Wimbledon",
  "Wood Green",
  "Other",
] as const;

export type LondonArea = (typeof LONDON_AREAS)[number];

// Simplified postcode prefix → area mapping
export const POSTCODE_AREA_MAP: Record<string, string> = {
  E14: "Canary Wharf",
  E15: "Stratford",
  E16: "Docklands",
  E8: "Dalston",
  E9: "Clapton",
  E2: "Bethnal Green",
  E3: "Bow",
  E1: "Stepney",
  E7: "Forest Gate",
  E10: "Leyton",
  E17: "Walthamstow",
  SE10: "Greenwich",
  SE13: "Lewisham",
  SE15: "Peckham",
  SE5: "Camberwell",
  SE1: "Bermondsey",
  SE17: "Elephant & Castle",
  SE11: "Kennington",
  SW9: "Brixton",
  SW4: "Clapham",
  SW11: "Battersea",
  SW17: "Tooting",
  SW16: "Streatham",
  SW8: "Stockwell",
  SW1: "Vauxhall",
  SW6: "Fulham",
  W6: "Hammersmith",
  W4: "Chiswick",
  W5: "Ealing",
  W3: "Ealing",
  W12: "Shepherds Bush",
  W11: "Notting Hill",
  W2: "Paddington",
  W1: "Mayfair",
  NW1: "Camden",
  N1: "Islington",
  N7: "Holloway",
  N4: "Finsbury Park",
  N16: "Stoke Newington",
  N17: "Tottenham",
  N22: "Wood Green",
  IG11: "Barking",
  IG1: "Ilford",
  RM1: "Romford",
  CR0: "Croydon",
  SW19: "Wimbledon",
  KT1: "Kingston",
  TW1: "Twickenham",
  HA0: "Wembley",
  HA1: "Harrow",
};

/** Detect London area from a postcode string. Returns null if no match found. */
export function detectAreaFromPostcode(postcode: string): string | null {
  const cleaned = postcode.toUpperCase().replace(/\s/g, "");
  // Try full outward code first (e.g. "SE17"), then 2-char prefix (e.g. "SE")
  for (const [prefix, area] of Object.entries(POSTCODE_AREA_MAP)) {
    if (cleaned.startsWith(prefix)) return area;
  }
  return null;
}

// ──────────────────────────────────────────────────────────
// Sub-types (stored as JSONB)
// ──────────────────────────────────────────────────────────

export type RoomConfig = {
  room_number: number;
  room_type: RoomType;
  expected_rent_pcm: number; // pence
  ai_recommended_rent_pcm: number | null; // pence — populated after AI run
  couples_allowed: boolean;
};

export type AIRecommendedRent = {
  room_type: RoomType;
  recommended_rent_pcm: number; // pence
  reasoning: string;
};

export type ComparableProperty = {
  area: string;
  room_count: number;
  property_type: PropertyType;
  avg_rent_pcm: number; // pence
  avg_occupancy_rate: number; // 0–1
  avg_vacancy_days: number;
};

export type RiskFlag = {
  severity: "warning" | "info";
  message: string;
};

// ──────────────────────────────────────────────────────────
// Core Evaluation type
// ──────────────────────────────────────────────────────────

export type Evaluation = {
  id: string;
  tenant_id: string;
  portfolio_id: string | null;
  created_by: string | null;
  status: EvaluationStatus;
  linked_property_id: string | null;

  // Property details
  address: string;
  postcode: string;
  detected_area: string;
  property_type: PropertyType;
  total_rooms: number;
  furnished: boolean;

  // Setup costs (pence)
  furniture_cost: number | null;
  refurbishment_cost: number | null;
  upfront_fees: number | null;
  agency_fees: number | null;
  other_setup_costs: number | null;
  other_setup_costs_label: string | null;
  total_setup_cost: number;

  // Monthly costs (pence)
  rent_to_landlord_pcm: number;
  bills_pcm: number | null;
  council_tax_pcm: number | null;
  cleaning_pcm: number | null;
  insurance_pcm: number | null;
  other_costs_pcm: number | null;
  other_costs_label: string | null;
  total_monthly_costs: number;

  // Revenue
  expected_occupancy_rate: number; // 0–1
  rooms: RoomConfig[];
  projected_monthly_income: number; // pence

  // AI output
  ai_recommended_rents: AIRecommendedRent[] | null;
  ai_recommended_occupancy: number | null;
  ai_reasoning: string | null;
  ai_comparable_properties: ComparableProperty[] | null;
  ai_risk_flags: RiskFlag[] | null;
  ai_generated_at: string | null;

  // Break-even
  monthly_net_profit: number; // pence
  break_even_months: number;
  break_even_date: string | null; // ISO date string
  annual_roi_percentage: number; // e.g. 24.5

  // Outcome
  actual_vs_predicted_notes: string | null;

  created_at: string;
  updated_at: string;

  // Joined
  portfolio?: { id: string; name: string; color: string } | null;
  linked_property?: { id: string; name: string } | null;
};

// ──────────────────────────────────────────────────────────
// Zod Schemas for form validation
// ──────────────────────────────────────────────────────────

export const RoomConfigSchema = z.object({
  room_number: z.number().int().positive(),
  room_type: z.enum(["single", "double", "master", "ensuite"]),
  expected_rent_pcm: z.number().int().positive("Rent must be positive"),
  ai_recommended_rent_pcm: z.number().int().nullable().optional(),
  couples_allowed: z.boolean().default(false),
});

export const EvaluationFormSchema = z.object({
  portfolio_id: z.string().uuid("Select a portfolio"),
  address: z.string().min(5, "Enter a full address"),
  postcode: z.string().min(3, "Enter a valid postcode"),
  detected_area: z.string().min(1, "Select an area"),
  property_type: z.enum(["hmo", "studio", "whole_flat"]),
  total_rooms: z.number().int().min(1).max(20),
  furnished: z.boolean().default(true),

  // Setup costs (in £ for form input, converted to pence on save)
  furniture_cost: z.number().nullable().optional(),
  refurbishment_cost: z.number().nullable().optional(),
  upfront_fees: z.number().nullable().optional(),
  agency_fees: z.number().nullable().optional(),
  other_setup_costs: z.number().nullable().optional(),
  other_setup_costs_label: z.string().nullable().optional(),

  // Monthly costs (in £)
  rent_to_landlord_pcm: z.number().positive("Rent to landlord is required"),
  bills_pcm: z.number().nullable().optional(),
  council_tax_pcm: z.number().nullable().optional(),
  cleaning_pcm: z.number().nullable().optional(),
  insurance_pcm: z.number().nullable().optional(),
  other_costs_pcm: z.number().nullable().optional(),
  other_costs_label: z.string().nullable().optional(),

  expected_occupancy_rate: z.number().min(0.1).max(1),
  rooms: z.array(RoomConfigSchema).min(1, "Add at least one room"),
  actual_vs_predicted_notes: z.string().nullable().optional(),
});

export type EvaluationFormValues = z.infer<typeof EvaluationFormSchema>;

// ──────────────────────────────────────────────────────────
// Utility: break-even calculations (all inputs in pence)
// ──────────────────────────────────────────────────────────

export function calculateBreakEven(params: {
  rooms: RoomConfig[];
  occupancy_rate: number;
  rent_to_landlord_pcm: number;
  bills_pcm: number;
  council_tax_pcm: number;
  cleaning_pcm: number;
  insurance_pcm: number;
  other_costs_pcm: number;
  furniture_cost: number;
  refurbishment_cost: number;
  upfront_fees: number;
  agency_fees: number;
  other_setup_costs: number;
  created_at?: string;
}) {
  const totalSetupCost =
    params.furniture_cost +
    params.refurbishment_cost +
    params.upfront_fees +
    params.agency_fees +
    params.other_setup_costs;

  const grossIncome = params.rooms.reduce((s, r) => s + r.expected_rent_pcm, 0);
  const projectedMonthlyIncome = Math.round(grossIncome * params.occupancy_rate);

  const totalMonthlyCosts =
    params.rent_to_landlord_pcm +
    params.bills_pcm +
    params.council_tax_pcm +
    params.cleaning_pcm +
    params.insurance_pcm +
    params.other_costs_pcm;

  const monthlyNetProfit = projectedMonthlyIncome - totalMonthlyCosts;

  let breakEvenMonths = 0;
  let breakEvenDate: string | null = null;
  let annualRoi = 0;

  if (monthlyNetProfit > 0 && totalSetupCost > 0) {
    breakEvenMonths = Math.ceil(totalSetupCost / monthlyNetProfit);
    const base = params.created_at ? new Date(params.created_at) : new Date();
    const beDate = new Date(base);
    beDate.setMonth(beDate.getMonth() + breakEvenMonths);
    breakEvenDate = beDate.toISOString().slice(0, 10);
    annualRoi = ((monthlyNetProfit * 12) / totalSetupCost) * 100;
  }

  return {
    total_setup_cost: totalSetupCost,
    projected_monthly_income: projectedMonthlyIncome,
    total_monthly_costs: totalMonthlyCosts,
    monthly_net_profit: monthlyNetProfit,
    break_even_months: breakEvenMonths,
    break_even_date: breakEvenDate,
    annual_roi_percentage: Math.round(annualRoi * 100) / 100,
  };
}

/** Convert £ amount to pence */
export const poundsToP = (v: number | null | undefined): number =>
  Math.round((v ?? 0) * 100);

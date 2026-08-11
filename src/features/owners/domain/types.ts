// Property owners (the PM module's `owner_landlords` table).
//
// NOT to be confused with `src/features/landlords`, which is the
// rental-agency CRM's `landlords` table. Different table, different
// route (/landlords vs /owners), no relationship between them.

import type { OwnerLandlord } from "@/features/properties/domain/types";

export type { OwnerLandlord };

export type OwnerPaymentSchedule = NonNullable<OwnerLandlord["payment_schedule"]>;
export type OwnerManagementFeeType = OwnerLandlord["management_fee_type"];

export const PAYMENT_SCHEDULE_LABELS: Record<OwnerPaymentSchedule, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  biannual: "Every 6 months",
  annual: "Annually",
};

export const MANAGEMENT_FEE_TYPE_LABELS: Record<OwnerManagementFeeType, string> = {
  none: "No fee",
  percent: "% of rent due",
  flat: "Flat monthly fee",
};

/** One of the owner's properties, as shown on the Properties tab. */
export type OwnerPropertySummary = {
  id: string;
  name: string;
  address_line_1: string | null;
  postcode: string | null;
  property_type: string | null;
  total_rooms: number | null;
  occupied_units: number;
  total_units: number;
};

/**
 * Row on /owners. `last_statement_*` and `closing_balance_pence` come from
 * the owner's most recent non-void statement, so the list doubles as a
 * "who still needs sending" worklist.
 */
export type OwnerListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  management_fee_type: OwnerManagementFeeType;
  management_fee_percent: number | null;
  management_fee_amount: number | null;
  contract_expiry_date: string | null;
  property_count: number;
  last_statement_period: { year: number; month: number } | null;
  last_statement_status: string | null;
  closing_balance_pence: number | null;
  /** Statements in draft/approved — i.e. generated but not yet sent. */
  unsent_count: number;
};

/** Everything the owner detail page needs in one fetch. */
export type OwnerDetail = {
  owner: OwnerLandlord;
  properties: OwnerPropertySummary[];
};

/** Human label for a fee config, e.g. "10% of rent" or "£75/mo". */
export function formatFeeConfig(
  type: OwnerManagementFeeType,
  percent: number | null,
  amount: number | null
): string {
  if (type === "percent" && percent != null) return `${Number(percent)}% of rent`;
  if (type === "flat" && amount != null) return `£${Number(amount).toFixed(2)}/mo`;
  return "No fee";
}

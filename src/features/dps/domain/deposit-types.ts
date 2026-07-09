import { z } from "zod";
import type { DpsDepositStatus } from "@/lib/dps/statusMap";

export type { DpsDepositStatus } from "@/lib/dps/statusMap";

// ── Row type (mirrors the dps_deposits table) ───────────────────────────────
export type DpsDeposit = {
  id: string;
  tenant_id: string;
  contract_id: string;
  status: DpsDepositStatus;
  deposit_id: string | null;
  allocation_reference: string | null;
  payment_reference: string | null;
  request_id: string | null;
  deposit_amount_pence: number | null;
  request_payload: Record<string, unknown> | null;
  errors: unknown[] | null;
  protected_confirmed_at: string | null;
  protected_confirmed_by: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  contract?: {
    id: string;
    deposit: number;
    deposit_scheme: string;
    deposit_scheme_ref: string | null;
    deposit_protected_date: string | null;
    start_date: string;
    expiry_date: string | null;
    pm_tenant?: { full_name: string; email: string; phone: string } | null;
    unit?: {
      room_number: string | null;
      unit_type: string;
      property: { name: string; address_line_1: string } | null;
    } | null;
  } | null;
};

export const DPS_STATUS_CONFIG: Record<DpsDepositStatus, { label: string; bg: string; fg: string }> = {
  draft:               { label: "Draft",              bg: "bg-gray-100",   fg: "text-gray-600"   },
  submitted:           { label: "Submitted",          bg: "bg-blue-100",   fg: "text-blue-700"   },
  created:             { label: "Awaiting payment",   bg: "bg-amber-100",  fg: "text-amber-700"  },
  marked_for_transfer: { label: "Awaiting transfer",  bg: "bg-indigo-100", fg: "text-indigo-700" },
  protected:           { label: "Protected",          bg: "bg-green-100",  fg: "text-green-700"  },
  failed:              { label: "Failed",             bg: "bg-red-100",    fg: "text-red-700"    },
  error:               { label: "Error",              bg: "bg-red-100",    fg: "text-red-700"    },
};

// ── DPS enums (Create Tenancy design note §4.1.3) ───────────────────────────
// Passed to the API as numbers.
export const DPS_PROPERTY_TYPES = [
  { value: 1, label: "Terraced" },
  { value: 2, label: "Detached" },
  { value: 3, label: "Semi-detached" },
  { value: 4, label: "Flat / Apartment" },
  { value: 5, label: "Maisonette" },
  { value: 6, label: "Bungalow" },
  { value: 7, label: "Studio / Bedsit" },
] as const;

export const DPS_FURNISHING_TYPES = [
  { value: 1, label: "Furnished" },
  { value: 2, label: "Unfurnished" },
  { value: 3, label: "Part furnished" },
  { value: 4, label: "White goods only" },
] as const;

export const DPS_RENT_FREQUENCIES = [
  { value: 1, label: "Monthly" },
  { value: 2, label: "4-weekly" },
  { value: 3, label: "Weekly" },
] as const;

// ── Registration wizard input ───────────────────────────────────────────────
// Mirrors the DPS-side validation (lengths per the design note) so bad input
// fails inline before an API round-trip. Same schema runs client + server.

const optionalRef = z
  .string()
  .trim()
  .max(35, "Max 35 characters")
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || v.length >= 3, { message: "Min 3 characters if provided" });

// A tenant must supply an email OR a mobile (design note: mobile mandatory
// when no email and vice versa). GB mobiles must start 07 and be 11 digits.
export const dpsTenantSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(30, "Max 30 characters"),
    firstName: z.string().trim().min(2, "Min 2 characters").max(50, "Max 50 characters"),
    lastName: z.string().trim().min(2, "Min 2 characters").max(50, "Max 50 characters"),
    email: z
      .string()
      .trim()
      .email("Enter a valid email")
      .max(99, "Max 99 characters")
      .optional()
      .or(z.literal("")),
    mobile: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || /^07\d{9}$/.test(v.replace(/\s+/g, "")), {
        message: "UK mobiles must start 07 and be 11 digits",
      }),
    tenantReference: optionalRef,
  })
  .refine((p) => Boolean(p.email) || Boolean(p.mobile), {
    message: "Provide an email or a mobile number",
    path: ["email"],
  });

// Optional: someone who paid part/all of the deposit on the tenant's behalf.
// They receive a copy of the protection certificate for information only.
export const dpsRelevantPersonSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50, "Max 50 characters"),
  lastName: z.string().trim().min(2, "Min 2 characters").max(50, "Max 50 characters"),
  email: z.string().trim().email("Enter a valid email").max(99, "Max 99 characters"),
  companyName: z
    .string()
    .trim()
    .max(35, "Max 35 characters")
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || v.length >= 2, { message: "Min 2 characters if provided" }),
  mobile: z.string().trim().max(15, "Max 15 digits").optional().or(z.literal("")),
});

export const dpsPropertySchema = z.object({
  addressLine1: z.string().trim().min(1, "Address line 1 is required").max(50, "Max 50 characters"),
  addressLine2: z.string().trim().max(50, "Max 50 characters").optional().or(z.literal("")),
  addressLine3: z.string().trim().max(50, "Max 50 characters").optional().or(z.literal("")),
  town: z.string().trim().min(1, "Town is required").max(50, "Max 50 characters"),
  county: z.string().trim().max(60, "Max 60 characters").optional().or(z.literal("")),
  postcode: z
    .string()
    .trim()
    .min(1, "Postcode is required")
    .max(12, "Max 12 characters"),
  propertyType: z.coerce.number().int().min(1).max(7).optional(),
  furnishingType: z.coerce.number().int().min(1).max(4).optional(),
  numberOfBedrooms: z.coerce.number().int().min(0).max(255).optional(),
});

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const dpsTenancySchema = z
  .object({
    startDate: z.string().min(1, "Start date is required"),
    tenancyLengthMonths: z.coerce
      .number({ invalid_type_error: "Enter the tenancy length" })
      .int("Whole months only")
      .min(1, "Min 1 month")
      .max(108, "Max 108 months"),
    rentAmount: z.coerce
      .number({ invalid_type_error: "Enter the rent amount" })
      .min(0.01, "Must be at least £0.01")
      .max(99999.99, "Max £99,999.99"),
    rentFrequency: z.coerce.number().int().min(1).max(3),
    depositAmount: z.coerce
      .number({ invalid_type_error: "Enter a deposit amount" })
      .min(0.01, "Must be at least £0.01")
      .max(999999.99, "Max £999,999.99"),
    datePaid: z.string().min(1, "Date paid is required"),
    tenancyReference: optionalRef,
  })
  // Verified UAT rule: DatePaid cannot be in the future (nor before 1980).
  .refine((t) => !t.datePaid || t.datePaid <= todayIso(), {
    message: "Date paid cannot be in the future",
    path: ["datePaid"],
  })
  .refine((t) => !t.datePaid || t.datePaid >= "1980-01-01", {
    message: "Date paid cannot be before 01/01/1980",
    path: ["datePaid"],
  })
  // Design note: DatePaid must be before the tenancy start date.
  .refine((t) => !t.datePaid || !t.startDate || t.datePaid < t.startDate, {
    message: "Date paid must be before the tenancy start date",
    path: ["datePaid"],
  });

export const registerDpsDepositSchema = z.object({
  contractId: z.string().uuid(),
  property: dpsPropertySchema,
  tenancy: dpsTenancySchema,
  tenants: z
    .array(dpsTenantSchema)
    .min(1, "At least one tenant is required")
    .max(10, "DPS accepts a maximum of 10 tenants"),
  relevantPerson: dpsRelevantPersonSchema.nullable().optional(),
});

export type RegisterDpsDepositInput = z.infer<typeof registerDpsDepositSchema>;
export type DpsTenantInput = z.infer<typeof dpsTenantSchema>;
export type DpsRelevantPersonInput = z.infer<typeof dpsRelevantPersonSchema>;

// ── Mark for bank transfer input ────────────────────────────────────────────
export const markDpsForBankTransferSchema = z.object({
  depositRowId: z.string().uuid(),
  allocationReference: z
    .string()
    .trim()
    .min(1, "Allocation reference is required")
    .max(18, "Max 18 characters")
    .regex(/^[A-Za-z0-9]+$/, "Letters and numbers only (no spaces)"),
});

export type MarkDpsForBankTransferInput = z.infer<typeof markDpsForBankTransferSchema>;

import { z } from "zod";
import type { TdsDepositStatus } from "@/lib/tds/statusMap";

export type { TdsDepositStatus } from "@/lib/tds/statusMap";

// ── Row type (mirrors the tds_deposits table) ───────────────────────────────
export type TdsDeposit = {
  id: string;
  tenant_id: string;
  contract_id: string;
  status: TdsDepositStatus;
  batch_id: string | null;
  dan: string | null;
  region: string | null;
  scheme_type: string | null;
  deposit_amount_pence: number | null;
  request_payload: Record<string, unknown> | null;
  status_response: Record<string, unknown> | null;
  warnings: unknown[] | null;
  errors: unknown[] | null;
  repayment_request: Record<string, unknown> | null;
  repayment_requested_at: string | null;
  repayment_requested_by: string | null;
  last_polled_at: string | null;
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

export const TDS_STATUS_CONFIG: Record<TdsDepositStatus, { label: string; bg: string; fg: string }> = {
  draft:     { label: "Draft",      bg: "bg-gray-100",  fg: "text-gray-600"  },
  submitted: { label: "Submitted",  bg: "bg-blue-100",  fg: "text-blue-700"  },
  pending:   { label: "Pending",    bg: "bg-amber-100", fg: "text-amber-700" },
  created:   { label: "Protected",  bg: "bg-green-100", fg: "text-green-700" },
  failed:    { label: "Failed",     bg: "bg-red-100",   fg: "text-red-700"   },
  error:     { label: "Error",      bg: "bg-red-100",   fg: "text-red-700"   },
};

// ── Registration wizard input ───────────────────────────────────────────────
export const FURNISHED_STATUSES = ["furnished", "part furnished", "unfurnished"] as const;

// A tenant / related-party (guarantor). Per the TDS spec a tenant must supply
// either an email OR a mobile (not necessarily both).
export const tdsPersonSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(30),
    firstName: z.string().trim().min(1, "First name is required").max(255),
    surname: z.string().trim().min(1, "Surname is required").max(255),
    email: z.string().trim().email("Enter a valid email").max(255).optional().or(z.literal("")),
    mobile: z.string().trim().max(30, "Max 30 characters").optional().or(z.literal("")),
  })
  .refine((p) => Boolean(p.email) || Boolean(p.mobile), {
    message: "Provide an email or a mobile number",
    path: ["email"],
  });

export const tdsLandlordSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(30),
    firstName: z.string().trim().min(1, "First name is required").max(255),
    surname: z.string().trim().min(1, "Surname is required").max(255),
    isBusiness: z.boolean().default(false),
    businessName: z.string().trim().max(100).optional().or(z.literal("")),
    paon: z.string().trim().min(1, "Building name/number is required").max(100),
    saon: z.string().trim().max(100).optional().or(z.literal("")),
    street: z.string().trim().min(1, "Street is required").max(100),
    locality: z.string().trim().max(100).optional().or(z.literal("")),
    town: z.string().trim().min(1, "Town is required").max(100),
    administrativeArea: z.string().trim().min(1, "County is required").max(100),
    postcode: z.string().trim().min(1, "Postcode is required").max(8),
    country: z.string().trim().max(100).optional().or(z.literal("")),
    email: z.string().trim().email("Enter a valid email").max(255).optional().or(z.literal("")),
    mobile: z.string().trim().max(30).optional().or(z.literal("")),
  })
  .refine((l) => !l.isBusiness || Boolean(l.businessName), {
    message: "Business name is required for a business landlord",
    path: ["businessName"],
  });

export const tdsPropertySchema = z.object({
  paon: z.string().trim().min(1, "Building name/number is required").max(100),
  saon: z.string().trim().max(100).optional().or(z.literal("")),
  street: z.string().trim().min(1, "Street is required").max(100),
  locality: z.string().trim().max(100).optional().or(z.literal("")),
  town: z.string().trim().min(1, "Town is required").max(100),
  administrativeArea: z.string().trim().min(1, "County is required").max(100),
  postcode: z.string().trim().min(1, "Postcode is required").max(8),
  furnishedStatus: z.enum(FURNISHED_STATUSES).optional(),
});

export const tdsTenancySchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "Expected end date is required"),
  depositReceivedDate: z.string().min(1, "Deposit received date is required"),
  depositAmount: z.coerce
    .number({ invalid_type_error: "Enter a deposit amount" })
    .positive("Deposit must be greater than 0")
    .max(999999.99, "Max £999,999.99"),
  rentAmount: z.coerce.number().min(0).max(999999.99).optional(),
});

export const registerTdsDepositSchema = z.object({
  contractId: z.string().uuid(),
  property: tdsPropertySchema,
  tenancy: tdsTenancySchema,
  leadTenant: tdsPersonSchema,
  jointTenants: z.array(tdsPersonSchema).default([]),
  relatedParties: z.array(tdsPersonSchema).default([]),
  landlord: tdsLandlordSchema,
});

export type RegisterTdsDepositInput = z.infer<typeof registerTdsDepositSchema>;
export type TdsPersonInput = z.infer<typeof tdsPersonSchema>;
export type TdsLandlordInput = z.infer<typeof tdsLandlordSchema>;

// ── Repayment request input ─────────────────────────────────────────────────
export const tdsAgentRepaymentSchema = z
  .object({
    total: z.coerce.number().min(0),
    cleaning: z.coerce.number().min(0).default(0),
    rentArrears: z.coerce.number().min(0).default(0),
    damage: z.coerce.number().min(0).default(0),
    redecoration: z.coerce.number().min(0).default(0),
    gardening: z.coerce.number().min(0).default(0),
    other: z.coerce.number().min(0).default(0),
    otherText: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine(
    (a) => {
      const sum = a.cleaning + a.rentArrears + a.damage + a.redecoration + a.gardening + a.other;
      return Math.round(sum * 100) === Math.round(a.total * 100);
    },
    { message: "The breakdown must add up to the agent total", path: ["total"] }
  )
  .refine((a) => !(a.other > 0) || Boolean(a.otherText), {
    message: "Describe the 'other' allocation",
    path: ["otherText"],
  });

export const raiseTdsRepaymentSchema = z.object({
  depositId: z.string().uuid(),
  tenancyEndDate: z.string().min(1, "Tenancy end date is required"),
  tenantRepayment: z.coerce.number().min(0),
  tenantRepaymentType: z.enum(["split", "lead"]),
  agent: tdsAgentRepaymentSchema,
});

export type RaiseTdsRepaymentInput = z.infer<typeof raiseTdsRepaymentSchema>;
export type TdsAgentRepaymentInput = z.infer<typeof tdsAgentRepaymentSchema>;

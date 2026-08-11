import { z } from "zod";

export type OwnerStatementStatus = "draft" | "approved" | "sent" | "void";

export type OwnerTransactionType =
  /** Contracted rent owed to the landlord, per property. The statement default. */
  | "rent_due"
  /** An ad-hoc receipt credited by hand. Not derived from tenant payments. */
  | "rent_received"
  | "management_fee"
  | "works_order"
  | "other_deduction"
  | "payment_to_owner"
  | "opening_balance"
  | "adjustment";

export type OwnerTransactionDirection = "in" | "out";

export type OwnerTransactionSourceKind =
  | "rent_payment"
  | "maintenance_cost"
  | "manual"
  | "computed";

export type ManagementFeeType = "none" | "percent" | "flat";

/** Normalised fee config read off an owner_landlords row. */
export type ManagementFeeConfig = {
  type: ManagementFeeType;
  /** Percentage value, e.g. 10 for 10% (used when type = 'percent'). */
  percent: number | null;
  /** Flat monthly fee in POUNDS (used when type = 'flat'). */
  amount: number | null;
};

/**
 * A statement's departure from the landlord's standing fee deal.
 * `type` null = not overridden; 'none' = deliberately no fee this period.
 */
export type FeeOverride = {
  type: ManagementFeeType | null;
  percent: number | null;
  amount: number | null;
};

export type OwnerTransaction = {
  id: string;
  tenant_id: string;
  owner_id: string;
  property_id: string | null;
  contract_id: string | null;
  statement_id: string | null;
  txn_date: string;
  type: OwnerTransactionType;
  direction: OwnerTransactionDirection;
  amount_pence: number;
  category: string | null;
  description: string | null;
  source_kind: OwnerTransactionSourceKind;
  source_id: string | null;
  reconciled: boolean;
  is_manual: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OwnerStatement = {
  id: string;
  tenant_id: string;
  owner_id: string;
  period_year: number;
  period_month: number;
  period_start: string;
  period_end: string;
  opening_balance_pence: number;
  closing_balance_pence: number;
  total_rent_received_pence: number;
  total_management_fee_pence: number;
  total_works_pence: number;
  total_other_pence: number;
  net_to_owner_pence: number;
  status: OwnerStatementStatus;
  pdf_storage_path: string | null;
  sent_at: string | null;
  generated_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Per-period departure from the owner's standing fee deal. Null type = none set.
  fee_override_type: ManagementFeeType | null;
  fee_override_percent: number | null;
  fee_override_amount: number | null;
  fee_override_by: string | null;
  fee_override_at: string | null;
};

/** owner_landlords subset used for statement generation + rendering. */
export type StatementOwner = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  management_fee_type: ManagementFeeType;
  management_fee_percent: number | null;
  management_fee_amount: number | null;
};


/** List-page row: statement + a light owner reference + property count. */
export type OwnerStatementListItem = OwnerStatement & {
  owner_name: string;
  owner_email: string | null;
};

/**
 * A maintenance cost in the statement period that was NOT charged to the
 * owner (maintenance_costs.recharge_to_owner = false). Surfaced so the agency
 * can see what it absorbed and put it back if that was a mistake.
 */
export type ExcludedWorksCost = {
  id: string;
  property_id: string | null;
  description: string;
  supplier: string | null;
  amount_pence: number;
  date_incurred: string;
};

/** Detail-page shape: statement + owner + its ledger lines. */
export type OwnerStatementWithLines = OwnerStatement & {
  owner: StatementOwner | null;
  transactions: OwnerTransaction[];
  /** property_id → property name, for grouping lines in the UI/PDF. */
  property_names: Record<string, string>;
  /** Costs in the period deliberately absorbed rather than recharged. */
  excluded_works: ExcludedWorksCost[];
  /**
   * Properties of this landlord with no agreed monthly rent recorded, so they
   * contribute nothing to the statement. Surfaced rather than silently
   * producing a £0 line.
   */
  properties_missing_rent: Array<{ id: string; name: string }>;
};

// ── Manual adjustment form ──────────────────────────────────
// A manual line the agency adds to a draft statement. Amount is entered in
// POUNDS and converted to pence in the server action. Validated on both the
// client (RHF) and the server.
export const adjustmentLineSchema = z.object({
  statement_id: z.string().uuid(),
  type: z.enum(["other_deduction", "payment_to_owner", "adjustment", "rent_received"]),
  property_id: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().uuid().nullable()
  ),
  description: z
    .string()
    .trim()
    .min(1, "Enter a description")
    .max(200, "Max 200 characters"),
  amount: z
    .number({ invalid_type_error: "Enter an amount" })
    .positive("Amount must be greater than 0")
    .max(1_000_000, "Amount looks too large"),
  txn_date: z.string().min(1, "Select a date"),
});

export type AdjustmentLineInput = z.infer<typeof adjustmentLineSchema>;

/** Owner-side direction for each manual line type. */
export const ADJUSTMENT_DIRECTION: Record<AdjustmentLineInput["type"], OwnerTransactionDirection> = {
  rent_received: "in",
  other_deduction: "out",
  payment_to_owner: "out",
  adjustment: "out",
};

// ── Management-fee override form ────────────────────────────
// Adjusts the fee on ONE statement. `apply_to_default` additionally writes the
// value back to the landlord's standing config for future periods; already-sent
// statements are never touched either way.
export const feeOverrideSchema = z
  .object({
    statement_id: z.string().uuid(),
    type: z.enum(["none", "percent", "flat"]),
    percent: z
      .number({ invalid_type_error: "Enter a percentage" })
      .min(0, "Cannot be negative")
      .max(100, "Cannot exceed 100%")
      .nullable()
      .optional(),
    amount: z
      .number({ invalid_type_error: "Enter an amount" })
      .min(0, "Cannot be negative")
      .max(1_000_000, "Amount looks too large")
      .nullable()
      .optional(),
    apply_to_default: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    if (val.type === "percent" && !(val.percent && val.percent > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["percent"],
        message: "Enter a percentage between 0 and 100",
      });
    }
    if (val.type === "flat" && !(val.amount && val.amount > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "Enter a fee amount",
      });
    }
  });

export type FeeOverrideInput = z.infer<typeof feeOverrideSchema>;

export const TRANSACTION_TYPE_LABELS: Record<OwnerTransactionType, string> = {
  rent_due: "Rent due",
  rent_received: "Rent received",
  management_fee: "Management fee",
  works_order: "Works order",
  other_deduction: "Other deduction",
  payment_to_owner: "Payment to owner",
  opening_balance: "Opening balance",
  adjustment: "Adjustment",
};

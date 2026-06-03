import { z } from "zod";
import type { CostMode } from "@/features/profitability/domain/types";

export type OverheadCategory =
  | "software"
  | "payroll"
  | "office_rent"
  | "accounting"
  | "insurance"
  | "marketing"
  | "professional_fees"
  | "bank_fees"
  | "other";

export const OVERHEAD_CATEGORY_LABELS: Record<OverheadCategory, string> = {
  software: "Software",
  payroll: "Payroll",
  office_rent: "Office Rent",
  accounting: "Accounting",
  insurance: "Insurance",
  marketing: "Marketing",
  professional_fees: "Professional Fees",
  bank_fees: "Bank Fees",
  other: "Other",
};

export type BusinessOverhead = {
  id: string;
  tenant_id: string;
  category: OverheadCategory;
  label: string;
  amount: number; // pence
  vendor: string | null;
  cost_mode: CostMode;
  recurrence_day: number | null;
  amortise_months: number | null;
  amortise_start_date: string | null;
  date_incurred: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

export const overheadSchema = z.object({
  category: z.enum([
    "software",
    "payroll",
    "office_rent",
    "accounting",
    "insurance",
    "marketing",
    "professional_fees",
    "bank_fees",
    "other",
  ] as const),
  label: z.string().min(1, "Label is required"),
  amount_pounds: z.coerce.number().positive("Amount must be greater than £0"),
  vendor: z.string().optional(),
  cost_mode: z.enum(["recurring", "one_off", "amortised"] as const),
  recurrence_day: z.coerce.number().int().min(1).max(31).optional().or(z.literal("")),
  amortise_months: z.coerce.number().int().positive().optional().or(z.literal("")),
  amortise_start_date: z.string().optional(),
  date_incurred: z.string().min(1, "Date is required"),
  is_active: z.boolean().default(true),
  notes: z.string().optional(),
});

export type OverheadFormValues = z.infer<typeof overheadSchema>;

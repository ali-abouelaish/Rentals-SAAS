import { z } from "zod";

export type TenantChargeType =
  | "utilities"
  | "service_charge"
  | "parking"
  | "cleaning"
  | "other";

export const TENANT_CHARGE_TYPE_LABELS: Record<TenantChargeType, string> = {
  utilities: "Utilities",
  service_charge: "Service Charge",
  parking: "Parking",
  cleaning: "Cleaning",
  other: "Other",
};

export type TenantRecurringCharge = {
  id: string;
  tenant_id: string;
  contract_id: string;
  charge_type: TenantChargeType;
  label: string;
  amount: number; // pence
  recurrence_day: number; // 1..31
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

export const tenantChargeSchema = z
  .object({
    contract_id: z.string().uuid("Pick a contract"),
    charge_type: z.enum([
      "utilities",
      "service_charge",
      "parking",
      "cleaning",
      "other",
    ] as const),
    label: z.string().min(1, "Label is required"),
    amount_pounds: z.coerce.number().positive("Amount must be greater than £0"),
    recurrence_day: z.coerce.number().int().min(1).max(31),
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().optional(),
    is_active: z.boolean().default(true),
    notes: z.string().optional(),
  })
  .refine((d) => !d.end_date || d.end_date >= d.start_date, {
    message: "End date must be on or after start date",
    path: ["end_date"],
  });

export type TenantChargeFormValues = z.infer<typeof tenantChargeSchema>;

/** Returns true if this charge is active for the given month. */
export function chargeActiveInMonth(
  charge: Pick<TenantRecurringCharge, "start_date" | "end_date" | "is_active">,
  msStr: string,
  meStr: string
): boolean {
  if (!charge.is_active) return false;
  if (charge.start_date > meStr) return false;
  if (charge.end_date && charge.end_date < msStr) return false;
  return true;
}

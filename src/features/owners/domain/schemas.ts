import { z } from "zod";

// The create schema is shared with the inline "New landlord" dialog on the
// property form (src/features/properties/ui/LandlordDialogs.tsx) so both
// entry points validate identically. Re-exported rather than duplicated.
export {
  ownerLandlordSchema,
  type OwnerLandlordFormValues,
} from "@/features/properties/domain/schemas";

const optionalDate = z
  .string()
  .trim()
  .max(10)
  .nullable()
  .optional()
  .or(z.literal(""));

/**
 * Full-record update from the owner detail page.
 *
 * Distinct from `ownerLandlordEditSchema`, whose action strips nulls and so
 * can never CLEAR a field. Here an explicit null means "clear it", which the
 * detail page needs (e.g. removing a fee, blanking an expiry date).
 */
export const ownerUpdateSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1, "Name is required").max(200, "Max 200 characters"),
    phone: z.string().trim().max(50, "Max 50 characters").nullable().optional().or(z.literal("")),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .nullable()
      .optional()
      .or(z.literal("")),
    address: z.string().trim().max(500, "Max 500 characters").nullable().optional().or(z.literal("")),
    notes: z.string().trim().max(2000, "Max 2000 characters").nullable().optional().or(z.literal("")),

    contract_start_date: optionalDate,
    contract_expiry_date: optionalDate,
    next_payment_due: optionalDate,
    payment_schedule: z
      .enum(["monthly", "quarterly", "biannual", "annual"])
      .nullable()
      .optional()
      .or(z.literal("")),
    monthly_rent_owed: z.coerce.number().min(0, "Cannot be negative").nullable().optional(),

    management_fee_type: z.enum(["none", "percent", "flat"]),
    management_fee_percent: z.coerce
      .number()
      .min(0, "Cannot be negative")
      .max(100, "Cannot exceed 100%")
      .nullable()
      .optional(),
    management_fee_amount: z.coerce
      .number()
      .min(0, "Cannot be negative")
      .nullable()
      .optional(),

    alert_60_days: z.boolean(),
    alert_30_days: z.boolean(),
  })
  .superRefine((val, ctx) => {
    // Same cross-field rule as the create schema: a fee type must carry a value.
    if (val.management_fee_type === "percent" && !(val.management_fee_percent && val.management_fee_percent > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["management_fee_percent"],
        message: "Enter a percentage between 0 and 100",
      });
    }
    if (val.management_fee_type === "flat" && !(val.management_fee_amount && val.management_fee_amount > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["management_fee_amount"],
        message: "Enter a monthly fee amount",
      });
    }
    if (
      val.contract_start_date &&
      val.contract_expiry_date &&
      val.contract_expiry_date < val.contract_start_date
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contract_expiry_date"],
        message: "Expiry cannot be before the start date",
      });
    }
  });

export type OwnerUpdateValues = z.infer<typeof ownerUpdateSchema>;

import { z } from "zod";
import { UNIT_STATUSES } from "@/features/properties/domain/types";

const unitStatusSchema = z.enum(UNIT_STATUSES as unknown as [string, ...string[]]);

const uuidSchema = z.string().uuid();

const baseShareObject = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).nullable().optional(),
  availability_statuses: z.array(unitStatusSchema).min(1, "Select at least one availability status"),
  commission_override_pct: z
    .number({ invalid_type_error: "Commission must be a number" })
    .min(0, "Commission cannot be negative")
    .max(100, "Commission cannot exceed 100%"),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  portfolio_id: uuidSchema.nullable().optional(),
  property_ids: z.array(uuidSchema).nullable().optional(),
});

const exclusiveScopeRefinement = (v: {
  portfolio_id?: string | null;
  property_ids?: string[] | null;
}) => !(v.portfolio_id && v.property_ids && v.property_ids.length > 0);

export const CreateShareSchema = baseShareObject.refine(exclusiveScopeRefinement, {
  message: "Choose either a portfolio or specific properties, not both",
  path: ["property_ids"],
});

export const UpdateShareSchema = baseShareObject.partial().refine(exclusiveScopeRefinement, {
  message: "Choose either a portfolio or specific properties, not both",
  path: ["property_ids"],
});

export type CreateShareInput = z.infer<typeof CreateShareSchema>;
export type UpdateShareInput = z.infer<typeof UpdateShareSchema>;

import { z } from "zod";

export const purposeEnum = z.enum([
  "viewing",
  "tenancy",
  "maintenance",
  "inspection",
  "other",
]);

export const returnedConditionEnum = z.enum(["good", "damaged", "lost"]);

export const createKeyEntrySchema = z
  .object({
    unitId: z.string().uuid().optional().nullable(),
    setName: z.string().trim().min(1, "Set name is required").max(80),
    copyLabel: z.string().trim().min(1, "Copy label is required").max(40),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export const createKeysSchema = z
  .object({
    keys: z.array(createKeyEntrySchema).min(1, "At least one key is required").max(50),
  })
  .strict();

export const checkoutSchema = z
  .object({
    heldByUserId: z.string().uuid().optional().nullable(),
    heldByContactName: z.string().trim().max(120).optional().nullable(),
    heldByContactPhone: z.string().trim().max(40).optional().nullable(),
    purpose: purposeEnum,
    expectedReturnAt: z.string().datetime().optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .strict()
  .refine(
    (v) => Boolean(v.heldByUserId) || (v.heldByContactName && v.heldByContactName.length > 0),
    { message: "Must record an internal user or a contact name", path: ["heldByContactName"] }
  );

export const checkinSchema = z
  .object({
    returnedCondition: returnedConditionEnum.optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export type CreateKeysInput = z.infer<typeof createKeysSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckinInput = z.infer<typeof checkinSchema>;

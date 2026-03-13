import { z } from "zod";

export const paymentMethodEnum = z.enum(["cash", "transfer", "card"]);
export const rentalStatusEnum = z.enum(["pending", "approved", "paid", "refunded"]);

export const rentalCodeSchema = z.object({
  client_id: z.string().uuid(),
  consultation_fee_amount: z.coerce.number().min(0),
  payment_method: paymentMethodEnum,
  // Optional fields: allow empty strings
  property_address: z.string(),
  licensor_name: z.string(),
  marketing_agent_id: z.string().uuid().optional().nullable().or(z.literal("")),
  marketing_agent_name: z.string().optional().nullable().or(z.literal(""))
});

export type RentalCodeFormValues = z.infer<typeof rentalCodeSchema>;

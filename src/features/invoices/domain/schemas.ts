import { z } from "zod";

export const invoiceItemSchema = z.object({
  description: z.string().min(2),
  quantity: z.coerce.number().min(0.01),
  rate: z.coerce.number().min(0),
  amount: z.coerce.number().min(0).optional()
});

export const invoiceManualSchema = z.object({
  billing_profile_id: z.string().uuid(),
  landlord_id: z.string().uuid(),
  issue_date: z.string().optional(),
  payment_terms_days: z.coerce.number().min(1).max(60).optional(),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1)
});

export const invoiceFromBonusesSchema = z.object({
  bonus_ids: z.array(z.string().uuid()).min(1),
  billing_profile_id: z.string().uuid(),
  issue_date: z.string().optional(),
  payment_terms_days: z.coerce.number().min(1).max(60).optional()
});

import { z } from "zod";

export const bonusSchema = z.object({
  bonus_date: z.string().min(1),
  client_name: z.string().min(2),
  property_address: z.string().min(3),
  landlord_id: z.string().uuid(),
  agent_id: z.string().uuid().optional(),
  amount_owed: z.coerce.number().min(0),
  payout_mode: z.enum(["standard", "full"]),
  notes: z.string().optional().or(z.literal(""))
});

export type BonusFormValues = z.infer<typeof bonusSchema>;

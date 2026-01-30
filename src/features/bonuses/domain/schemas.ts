import { z } from "zod";

export const bonusSchema = z.object({
  landlord_id: z.string().uuid(),
  amount_owed: z.coerce.number().min(0),
  payout_mode: z.enum(["standard", "full"])
});

export type BonusFormValues = z.infer<typeof bonusSchema>;

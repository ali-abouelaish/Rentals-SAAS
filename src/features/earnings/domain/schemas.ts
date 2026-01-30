import { z } from "zod";

export const earningsFilterSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  payment_method: z.string().optional()
});

export type EarningsFilterValues = z.infer<typeof earningsFilterSchema>;

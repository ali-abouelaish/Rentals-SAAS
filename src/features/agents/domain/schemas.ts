import { z } from "zod";

export const agentUpdateSchema = z.object({
  commission_percent: z.coerce.number().min(0).max(100),
  marketing_fee: z.coerce.number().min(0)
});

export type AgentUpdateValues = z.infer<typeof agentUpdateSchema>;

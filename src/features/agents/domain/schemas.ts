import { z } from "zod";

export const agentUpdateSchema = z.object({
  commission_percent: z.coerce.number().min(0).max(100),
  marketing_fee: z.coerce.number().min(0)
});

export type AgentUpdateValues = z.infer<typeof agentUpdateSchema>;

export const agentCreateSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1),
  role: z.enum(["admin", "agent", "marketing_only", "agent_and_marketing"])
});

export type AgentCreateValues = z.infer<typeof agentCreateSchema>;

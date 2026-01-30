import { z } from "zod";

export const clientStatusEnum = z.enum(["pending", "on_hold", "solved"]);

export const clientSchema = z.object({
  full_name: z.string().min(2),
  dob: z.string().optional().or(z.literal("")),
  phone: z.string().min(6),
  email: z.string().email().optional().or(z.literal("")),
  nationality: z.string().optional().or(z.literal("")),
  current_address: z.string().optional().or(z.literal("")),
  company_name: z.string().optional().or(z.literal("")),
  company_address: z.string().optional().or(z.literal("")),
  occupation: z.string().optional().or(z.literal("")),
  status: clientStatusEnum.default("pending"),
  assigned_agent_id: z.string().uuid().optional()
});

export type ClientFormValues = z.infer<typeof clientSchema>;

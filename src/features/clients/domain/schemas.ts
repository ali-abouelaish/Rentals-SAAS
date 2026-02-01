import { z } from "zod";

export const clientStatusEnum = z.enum(["pending", "on_hold", "solved"]);

export const clientSchema = z.object({
  full_name: z.string().min(2),
  dob: z.string().min(1),
  phone: z.string().min(6),
  email: z.string().email(),
  nationality: z.string().min(2),
  current_address: z.string().min(2),
  company_or_university_name: z.string().min(2),
  company_address: z.string().min(2),
  occupation: z.string().min(2),
  status: clientStatusEnum.default("pending"),
  assigned_agent_id: z.string().uuid().optional()
});

export type ClientFormValues = z.infer<typeof clientSchema>;

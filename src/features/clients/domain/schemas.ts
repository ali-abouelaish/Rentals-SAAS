import { z } from "zod";

export const clientStatusEnum = z.enum(["pending", "on_hold", "solved", "registered"]);

const shareCodeOptional = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || v.trim() === "" || /^[a-zA-Z0-9]+$/.test(v.trim()), {
    message: "Share code must be alphanumeric"
  });

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
  assigned_agent_id: z.string().uuid().optional(),
  agency_name: z.string().optional().nullable().or(z.literal("")),
  contact_number: z.string().optional().nullable().or(z.literal("")),
  share_code: shareCodeOptional
});

export type ClientFormValues = z.infer<typeof clientSchema>;

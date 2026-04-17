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
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  dob: z.string().min(1, "Date of birth is required"),
  phone: z.string().min(6, "Phone number must be at least 6 characters"),
  email: z.string().email("Please enter a valid email address"),
  nationality: z.string().min(2, "Nationality must be at least 2 characters"),
  current_address: z.string().min(2, "Current address must be at least 2 characters"),
  company_or_university_name: z.string().min(2, "Company / University name must be at least 2 characters"),
  company_address: z.string().min(2, "Company / University address must be at least 2 characters"),
  occupation: z.string().min(2, "Occupation must be at least 2 characters"),
  status: clientStatusEnum.default("pending"),
  assigned_agent_id: z.string().uuid().optional(),
  agency_name: z.string().optional().nullable().or(z.literal("")),
  contact_number: z.string().optional().nullable().or(z.literal("")),
  share_code: shareCodeOptional
});

export type ClientFormValues = z.infer<typeof clientSchema>;

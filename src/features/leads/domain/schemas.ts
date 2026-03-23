import { z } from "zod";

export const leadStatusEnum = z.enum(["new", "contacted", "viewing", "offer", "closed"]);

export const updateLeadStatusSchema = z.object({
  status: leadStatusEnum,
});

export const assignLeadSchema = z.object({
  assigned_to: z.string().uuid().nullable(),
});

export const platformConfigSchema = z.object({
  platform_name: z.string().min(2).max(50),
  sender_domain: z.string().min(4).max(100),
  is_active: z.boolean().default(true),
});

export type UpdateLeadStatusValues = z.infer<typeof updateLeadStatusSchema>;
export type AssignLeadValues = z.infer<typeof assignLeadSchema>;
export type PlatformConfigValues = z.infer<typeof platformConfigSchema>;

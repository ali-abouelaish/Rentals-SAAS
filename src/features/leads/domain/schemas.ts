import { z } from "zod";
import { isReservedPlatformName } from "./sources";

export const leadStatusEnum = z.enum(["new", "contacted", "viewing", "offer", "closed"]);

export const updateLeadStatusSchema = z.object({
  status: leadStatusEnum,
});

export const assignLeadSchema = z.object({
  assigned_to: z.string().uuid().nullable(),
});

export const platformConfigSchema = z.object({
  // A platform's name becomes the source of every lead parsed from its emails.
  // "website" and "business_card" are reserved: the AI assistant may read
  // first-party leads in full, so a Gmail platform must never pose as one.
  platform_name: z
    .string()
    .min(2)
    .max(50)
    .refine(
      (name) => !isReservedPlatformName(name),
      "That name is reserved for leads Harbor captures itself — use the portal's name"
    ),
  sender_domain: z.string().min(4).max(100),
  is_active: z.boolean().default(true),
});

/** Connecting a website on Leads → Settings mints a leads-only key with this label. */
export const websiteConnectionSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, "Give the website a name of at least 2 characters")
    .max(80, "Keep the name under 80 characters"),
});

/** The public business-card enquiry form (/public/card-enquiry/[agentId]). */
export const cardEnquirySchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(200, "Keep your name under 200 characters"),
  phone: z
    .string()
    .trim()
    .min(1, "Please enter your phone number")
    .max(50, "That phone number is too long")
    .refine((v) => {
      const digits = v.replace(/\D/g, "").length;
      return digits >= 7 && digits <= 15;
    }, "Enter a valid phone number"),
  pref_area: z.string().trim().max(200, "Keep this under 200 characters"),
  budget: z.string().trim().max(100, "Keep this under 100 characters"),
  occupation: z.string().trim().max(200, "Keep this under 200 characters"),
});

export type UpdateLeadStatusValues = z.infer<typeof updateLeadStatusSchema>;
export type AssignLeadValues = z.infer<typeof assignLeadSchema>;
export type PlatformConfigValues = z.infer<typeof platformConfigSchema>;
export type WebsiteConnectionValues = z.infer<typeof websiteConnectionSchema>;
export type CardEnquiryValues = z.infer<typeof cardEnquirySchema>;

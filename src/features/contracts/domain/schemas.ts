import { z } from "zod";

export const contractSchema = z.object({
  unit_id: z.string().uuid("Unit is required"),
  pm_tenant_id: z.string().uuid("Tenant is required"),
  start_date: z.string().min(1, "Start date is required"),
  rent_pcm: z.coerce.number().int().positive("Rent is required"),
  deposit: z.coerce.number().int().positive("Deposit is required"),
  collection_date: z.coerce.number().int().min(1).max(31).nullable().optional(),
  deposit_scheme: z.enum(["dps", "mydeposits", "tds", "none"]).default("none"),
  deposit_scheme_ref: z.string().nullable().optional().or(z.literal("")),
  deposit_protected_date: z.string().nullable().optional().or(z.literal("")),
  deposit_protection_alert: z.boolean().default(true),
  signing_method: z
    .enum(["email", "whatsapp", "adobe_sign", "docusign", "paper", "other"])
    .nullable()
    .optional(),
  status: z
    .enum(["draft", "sent", "signed", "active", "notice_given", "terminated"])
    .default("draft"),
  document_url: z.string().nullable().optional().or(z.literal("")),
  notes: z.string().nullable().optional().or(z.literal("")),
});
export type ContractFormValues = z.infer<typeof contractSchema>;

export const giveNoticeSchema = z.object({
  notice_given_by: z.enum(["tenant", "landlord"]),
  notice_given_date: z.string().min(1, "Date is required"),
  vacate_date: z.string().nullable().optional().or(z.literal("")),
});
export type GiveNoticeValues = z.infer<typeof giveNoticeSchema>;

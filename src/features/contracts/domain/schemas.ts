import { z } from "zod";

export const contractSchema = z.object({
  unit_id: z.string().uuid("Unit is required"),
  pm_tenant_id: z.string().uuid("Tenant is required"),
  start_date: z.string().min(1, "Start date is required"),
  expiry_date: z.string().nullable().optional().or(z.literal("")),
  rent_pcm: z.coerce.number().int().positive("Rent is required"),
  deposit: z.coerce.number().int().positive("Deposit is required"),
  collection_date: z.coerce.number().int().min(1).max(31).nullable().optional(),
  pro_rata_amount: z.coerce.number().min(0).nullable().optional(),
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
    .default("active"),
  document_url: z.string().nullable().optional().or(z.literal("")),
  notes: z.string().nullable().optional().or(z.literal("")),
}).refine(
  (v) => !v.expiry_date || v.expiry_date >= v.start_date,
  { message: "Expiry must be on or after start date", path: ["expiry_date"] }
);
export type ContractFormValues = z.infer<typeof contractSchema>;

export const giveNoticeSchema = z.object({
  notice_given_by: z.enum(["tenant", "landlord"]),
  notice_given_date: z.string().min(1, "Date is required"),
  vacate_date: z.string().nullable().optional().or(z.literal("")),
});
export type GiveNoticeValues = z.infer<typeof giveNoticeSchema>;

export const closeoutSchema = z.object({
  actual_end_date: z.string().min(1, "Move-out date is required"),
  end_reason: z.enum([
    "tenant_notice",
    "landlord_notice",
    "mutual",
    "breach",
    "abandoned",
    "other",
  ]),
  arrears_at_end: z.coerce.number().int().min(0).default(0),
  would_relet: z.union([z.boolean(), z.null()]).optional().default(null),
  end_notes: z.string().max(2000).nullable().optional().or(z.literal("")),
  // Null = not yet released. Capped at original deposit by DB check.
  deposit_returned: z.coerce.number().int().min(0).nullable().optional(),
  deposit_returned_at: z.string().nullable().optional().or(z.literal("")),
  deposit_release_notes: z.string().max(2000).nullable().optional().or(z.literal("")),
});
export type CloseoutValues = z.infer<typeof closeoutSchema>;

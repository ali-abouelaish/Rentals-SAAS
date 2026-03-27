import { z } from "zod";

// Converts empty strings to null for nullable DB fields
const ns = z.preprocess((v) => (v === "" ? null : v), z.string().nullable().optional());
// Same but for date columns — empty string → null (Postgres rejects "" for date type)
const nd = z.preprocess((v) => (v === "" ? null : v), z.string().nullable().optional());

export const pmTenantSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(6, "Phone is required"),
  whatsapp_number: ns,
  date_of_birth: nd,
  nationality: ns,
  current_address: ns,
  employment_status: z.preprocess(
    (v) => (v === "" ? null : v),
    z.enum(["professional", "student", "self_employed", "unemployed", "other"]).nullable().optional()
  ),
  employer_name: ns,
  employer_address: ns,
  job_title: ns,
  current_landlord_name: ns,
  current_landlord_contact: ns,
  right_to_rent_type: z.preprocess(
    (v) => (v === "" ? null : v),
    z.enum(["british_passport", "share_code", "eu_settled", "visa", "other"]).nullable().optional()
  ),
  right_to_rent_code: ns,
  right_to_rent_expiry: nd,
  right_to_rent_verified: z.boolean().default(false),
  emergency_contact_name: ns,
  emergency_contact_phone: ns,
  emergency_contact_relationship: ns,
  notes: ns,
  passport_photo_url: ns,
  passport_scan_url: ns,
});
export type PmTenantFormValues = z.infer<typeof pmTenantSchema>;

export const guarantorSchema = z.object({
  pm_tenant_id: z.string().uuid(),
  full_name: z.string().min(1, "Full name is required"),
  phone: z.string().min(6, "Phone is required"),
  email: z.string().email("Valid email required"),
  relationship: z.string().nullable().optional().or(z.literal("")),
  passport_url: z.string().nullable().optional().or(z.literal("")),
  payslips_url: z.string().nullable().optional().or(z.literal("")),
});
export type GuarantorFormValues = z.infer<typeof guarantorSchema>;

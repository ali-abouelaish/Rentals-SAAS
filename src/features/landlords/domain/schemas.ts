import { z } from "zod";

export const landlordSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contact: z.string().optional().or(z.literal("")),
  billing_address: z.string().optional().or(z.literal("")),
  email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  spareroom_profile_url: z
    .string()
    .url("Enter a full URL, e.g. https://www.spareroom.co.uk/…")
    .optional()
    .or(z.literal("")),
  pays_commission: z.enum(["yes", "no"]),
  // Preprocess: an empty input must stay optional — z.coerce.number("") is 0
  // anyway, but NaN from stray text should fail with a message, not silently.
  commission_amount_gbp: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : v),
    z.coerce.number({ invalid_type_error: "Enter an amount in pounds" }).min(0, "Cannot be negative")
  ),
  commission_term_text: z.string().optional().or(z.literal("")),
  we_do_viewing: z.enum(["yes", "no"]),
  profile_notes: z.string().optional().or(z.literal("")),
});

export type LandlordFormValues = z.infer<typeof landlordSchema>;

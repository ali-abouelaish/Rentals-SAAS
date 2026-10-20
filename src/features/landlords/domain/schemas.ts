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
  // The alternative to a SpareRoom profile: a landlord who keeps availability
  // in a spreadsheet. Both may be set; neither is required.
  spreadsheet_url: z
    .string()
    .url("Enter a full URL, e.g. https://docs.google.com/spreadsheets/d/…")
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

/**
 * Listings-map filters. Kept as the raw form strings: they travel in the URL
 * (?budget=900&double=1), so the same schema validates the form on the client
 * and the query string on the server.
 */
export const mapFilterSchema = z.object({
  budget: z
    .string()
    .trim()
    .regex(/^\d*$/, "Whole pounds only, e.g. 900")
    .refine((v) => v === "" || (Number(v) >= 1 && Number(v) <= 100000), "Enter between £1 and £100,000"),
  double: z.boolean(),
});

export type MapFilterValues = z.infer<typeof mapFilterSchema>;

/** Server side: a hand-edited or stale URL that fails validation means no filter, not an error. */
export function parseMapFilters(params: { budget?: string; double?: string }): {
  budget: number | null;
  double: boolean;
} {
  // Field by field, so a bad budget doesn't also throw away a valid double flag.
  const budget = mapFilterSchema.shape.budget.safeParse(params.budget ?? "");
  return {
    budget: budget.success && budget.data ? Number(budget.data) : null,
    // "on" is what the form sends if it is submitted natively, before hydration.
    double: params.double === "1" || params.double === "on",
  };
}

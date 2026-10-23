import { z } from "zod";
import { isAbsoluteUrl } from "@/features/listing-feeds/domain/fields";

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

/** Agency-wide "Daily SpareRoom scraping" switch on the Landlords page. */
export const scraperScheduleSchema = z.object({
  enabled: z.boolean(),
});

export type ScraperScheduleValues = z.infer<typeof scraperScheduleSchema>;

// ── Manual listings ────────────────────────────────────────────────────────

export const BILLS_OPTIONS = ["Yes", "No", "Some"] as const;
export const FURNISHING_OPTIONS = ["Furnished", "Part furnished", "Unfurnished"] as const;
export const COUPLES_OPTIONS = ["Yes", "No"] as const;

export const MAX_MANUAL_PHOTOS = 20;

/** Pounds as typed: "750", "750.50", "£1,200". Blank is allowed. */
function money(label: string) {
  return z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v.replace(/[£,\s]/g, "")),
      `Enter ${label} in pounds, e.g. 750`
    )
    .refine(
      (v) => v === "" || Number(v.replace(/[£,\s]/g, "")) <= 100000,
      "Must be £100,000 or less"
    );
}

/** The non-empty, trimmed lines of the photo links box. */
export function photoLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * A listing typed in by hand on the landlord page. Every value is the raw form
 * string — the same schema validates the dialog (zodResolver) and the server
 * action (safeParse), and `manualListingToRow` converts it to columns.
 */
export const manualListingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or fewer"),
  location: z.string().trim().max(300, "Location must be 300 characters or fewer"),
  price: money("the rent"),
  deposit: money("the deposit"),
  available_date: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))),
      "Pick a date from the calendar"
    ),
  min_term: z.string().trim().max(50, "Minimum term must be 50 characters or fewer"),
  property_type: z.string().trim().max(100, "Property type must be 100 characters or fewer"),
  room_count: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+$/.test(v), "Whole number only, e.g. 2")
    .refine((v) => v === "" || (Number(v) >= 1 && Number(v) <= 50), "Enter between 1 and 50"),
  bills_included: z.enum(["", ...BILLS_OPTIONS]),
  furnishings: z.enum(["", ...FURNISHING_OPTIONS]),
  couples_ok: z.enum(["", ...COUPLES_OPTIONS]),
  url: z
    .string()
    .trim()
    .refine((v) => v === "" || isAbsoluteUrl(v), "Enter a full link starting with https://"),
  photo_urls: z.string().superRefine((value, ctx) => {
    const lines = photoLines(value);
    if (lines.length > MAX_MANUAL_PHOTOS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Up to ${MAX_MANUAL_PHOTOS} photo links — you have ${lines.length}`,
      });
      return;
    }
    const bad = lines.findIndex((line) => !isAbsoluteUrl(line));
    if (bad !== -1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Line ${bad + 1} isn't a link — each line must start with https://`,
      });
    }
  }),
  description: z.string().trim().max(5000, "Description must be 5,000 characters or fewer"),
});

export type ManualListingValues = z.infer<typeof manualListingSchema>;

export const EMPTY_MANUAL_LISTING: ManualListingValues = {
  title: "",
  location: "",
  price: "",
  deposit: "",
  available_date: "",
  min_term: "",
  property_type: "",
  room_count: "",
  bills_included: "",
  furnishings: "",
  couples_ok: "",
  url: "",
  photo_urls: "",
  description: "",
};

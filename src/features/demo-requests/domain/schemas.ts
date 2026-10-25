import { z } from "zod";
// Relative with the extension (not "@/…") so `npm test` can load this module directly.
import { emailField } from "../../auth/domain/schemas.ts";

/** Portfolio size, in rooms. Stored as the slug; the labels are what the form and the inbox show. */
export const PORTFOLIO_SIZES = [
  { value: "under_10", chip: "Under 10", label: "Under 10 rooms" },
  { value: "10_49", chip: "10–49", label: "10–49 rooms" },
  { value: "50_99", chip: "50–99", label: "50–99 rooms" },
  { value: "100_200", chip: "100–200", label: "100–200 rooms" },
  { value: "200_plus", chip: "200+", label: "200+ rooms" },
] as const;
export type PortfolioSize = (typeof PORTFOLIO_SIZES)[number]["value"];
const PORTFOLIO_VALUES = PORTFOLIO_SIZES.map((p) => p.value) as [PortfolioSize, ...PortfolioSize[]];

export const PLAN_INTERESTS = ["standard", "enterprise"] as const;
export type PlanInterest = (typeof PLAN_INTERESTS)[number];

/**
 * Letters (any alphabet), spaces, hyphens and apostrophes. Deliberately no digits, dots, slashes or
 * colons: the first name is the only thing the requester's confirmation email repeats back, so it
 * must not be able to carry a link (a stranger can type anyone's address into the form).
 */
const NAME = /^[\p{L}\p{M}][\p{L}\p{M} '’-]*$/u;

// pipe(): an empty name only says what's missing, not that it's also the wrong shape
const name = (missing: string) =>
  z
    .string()
    .trim()
    .min(1, missing)
    .pipe(
      z
        .string()
        .max(60, "Keep it under 60 characters")
        .regex(NAME, "Use letters, spaces, hyphens or apostrophes")
    );

export const GOAL_MAX = 1000;
const TERMS_MESSAGE = "Tick the box to agree to the terms and privacy policy";

export const demoRequestSchema = z.object({
  first_name: name("Enter your first name"),
  last_name: name("Enter your last name"),
  email: emailField,
  company: z.string().trim().min(1, "Enter your company name").max(120, "Keep it under 120 characters"),
  portfolio_size: z.enum(PORTFOLIO_VALUES, {
    errorMap: () => ({ message: "Choose the size of your portfolio" }),
  }),
  goal: z
    .string()
    .trim()
    .max(GOAL_MAX, `Keep it under ${GOAL_MAX.toLocaleString("en-GB")} characters`),
  // A boolean that must be true (not z.literal(true)), so the form can hold it unticked.
  terms: z
    .boolean({ errorMap: () => ({ message: TERMS_MESSAGE }) })
    .refine((agreed) => agreed, { message: TERMS_MESSAGE }),
  plan: z.enum(PLAN_INTERESTS).nullable(),
});
export type DemoRequestValues = z.infer<typeof demoRequestSchema>;

/** The form field a person never sees. Anything in it means a bot filled the form in. */
export const HONEYPOT_FIELD = "leave_blank";

/** A super admin's own notes on a request (the admin page). */
export const NOTES_MAX = 4000;
export const demoNotesSchema = z.object({
  notes: z.string().trim().max(NOTES_MAX, `Keep notes under ${NOTES_MAX.toLocaleString("en-GB")} characters`),
});
export type DemoNotesValues = z.infer<typeof demoNotesSchema>;

export function portfolioLabel(value: string): string {
  return PORTFOLIO_SIZES.find((p) => p.value === value)?.label ?? value;
}

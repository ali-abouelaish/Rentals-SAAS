import { z } from "zod";
import { DATA_KEY_SOURCES } from "./data-keys";

export const fieldSourceSchema = z.enum([
  "booking_response",
  "property",
  "unit",
  "landlord",
  "agency",
  "booking",
  "pm_tenant",
  "manual",
  "computed",
  "contract",
]);

export const fieldFormatSchema = z.enum(["text", "date", "currency_gbp", "number", "multiline"]);
export const fieldKindSchema = z.enum(["data", "signature", "initial", "date_signed"]);
export const signerRoleSchema = z.enum(["tenant", "landlord", "guarantor"]);
export const fieldFontWeightSchema = z.enum(["normal", "bold"]);
export const fieldTextAlignSchema = z.enum(["left", "center", "right"]);
export const depositSchemeSchema = z.enum(["dps", "mydeposits", "tds", "none"]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a full date (DD/MM/YYYY)");

export const templateFieldInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    label: z.string().min(1).max(120),
    page_index: z.number().int().min(0),
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().positive(),
    height: z.number().positive(),
    field_kind: fieldKindSchema.default("data"),
    signer_role: signerRoleSchema.nullable().default(null),
    // Null for e-signature fields, which bind to no data.
    source: fieldSourceSchema.nullable(),
    question_id: z.string().uuid().nullable(),
    data_key: z.string().max(120).nullable(),
    manual_key: z.string().max(60).nullable(),
    manual_default: z.string().max(500).nullable(),
    format: fieldFormatSchema,
    font_size: z.number().min(4).max(48),
    font_weight: fieldFontWeightSchema,
    text_align: fieldTextAlignSchema,
    truncate_overflow: z.boolean(),
    ai_confidence: z.number().min(0).max(1).nullable(),
    sort_order: z.number().int().min(0),
  })
  .superRefine((value, ctx) => {
    // E-signature fields bind to no data — they need a signer instead, and none
    // of the source/data_key rules below apply to them.
    if (value.field_kind !== "data") {
      if (!value.signer_role) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["signer_role"],
          message: "Choose who signs this field",
        });
      }
      return;
    }

    if (!value.source) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source"],
        message: "source is required for a merge field",
      });
      return;
    }

    if (value.source === "booking_response" && !value.question_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["question_id"],
        message: "question_id is required when source is booking_response",
      });
    }
    if (DATA_KEY_SOURCES.includes(value.source) && !value.data_key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data_key"],
        message: "data_key is required for this source",
      });
    }
    if (value.source === "manual" && !value.manual_key?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["manual_key"],
        message: "manual_key is required when source is manual",
      });
    }
  });

export const saveTemplateFieldsSchema = z.object({
  templateId: z.string().uuid(),
  fields: z.array(templateFieldInputSchema).max(500),
});

export const updateTemplateMetaSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Template name is required").max(120, "Max 120 characters"),
  description: z.string().max(2000).nullable(),
  portfolio_id: z.string().uuid().nullable(),
  is_active: z.boolean(),
});

// ─── Template upload ─────────────────────────────────────────────
export const TEMPLATE_MAX_BYTES = 10 * 1024 * 1024;
export const TEMPLATE_MAX_PAGES = 20;

/** Metadata half of the upload, shared by the form and the server action. */
export const uploadTemplateMetaSchema = z.object({
  name: z.string().trim().min(1, "Template name is required").max(120, "Max 120 characters"),
  description: z.string().trim().max(2000, "Max 2000 characters"),
  portfolio_id: z.union([z.literal(""), z.string().uuid("Choose a portfolio from the list")]),
});

// ─── Contract terms ──────────────────────────────────────────────
/** The terms a contract is generated with (server-side, numeric). */
export const contractTermsSchema = z
  .object({
    start_date: isoDate,
    expiry_date: isoDate.nullable(),
    rent_pcm: z.number().int("Rent must be whole pounds").positive("Rent must be greater than 0"),
    deposit: z.number().int("Deposit must be whole pounds").min(0, "Deposit can't be negative"),
    collection_date: z.number().int().min(1).max(31).nullable(),
    deposit_scheme: depositSchemeSchema.nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.expiry_date && v.expiry_date <= v.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiry_date"],
        message: "Expiry must be after the start date",
      });
    }
  });

export const generateContractSchema = z.object({
  templateId: z.string().uuid(),
  bookingId: z.string().uuid(),
  // When set, stamp this exact contract (e.g. the one approveBooking just
  // created) instead of searching for one. Lets the convert-to-tenancy flow
  // attach a PDF to an active contract too.
  contractId: z.string().uuid().optional(),
  manualValues: z.record(z.string(), z.string().max(2000)),
  terms: contractTermsSchema,
});

// ─── Generation form (client) ────────────────────────────────────
// Inputs arrive as strings; the dialog converts them to ContractTerms after
// this passes. Kept beside the server schema so the two can't drift on rules.
const wholePounds = (label: string, { allowZero }: { allowZero: boolean }) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => /^\d+$/.test(v), `${label} must be whole pounds (no pence)`)
    .refine((v) => (allowZero ? Number(v) >= 0 : Number(v) > 0), `${label} must be greater than 0`);

export const contractGenerationFormSchema = z
  .object({
    template_id: z.string(),
    start_date: z.string().min(1, "Start date is required").pipe(isoDate),
    expiry_date: z.union([z.literal(""), isoDate]),
    rent_pcm: wholePounds("Rent", { allowZero: false }),
    deposit: wholePounds("Deposit", { allowZero: true }),
    manual: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        format: z.string(),
        value: z.string().max(2000, "Max 2000 characters"),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.expiry_date && v.start_date && v.expiry_date <= v.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiry_date"],
        message: "Expiry must be after the start date",
      });
    }
    v.manual.forEach((m, i) => {
      if (!m.value.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["manual", i, "value"],
          message: `${m.label} is required — it is printed on the contract`,
        });
      } else if (m.format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(m.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["manual", i, "value"],
          message: "Pick a full date",
        });
      }
    });
  });

export type ContractGenerationFormValues = z.infer<typeof contractGenerationFormSchema>;

export const uuidSchema = z.string().uuid();

import { z } from "zod";

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
]);

export const fieldFormatSchema = z.enum(["text", "date", "currency_gbp", "number", "multiline"]);
export const fieldFontWeightSchema = z.enum(["normal", "bold"]);
export const fieldTextAlignSchema = z.enum(["left", "center", "right"]);

export const templateFieldInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    label: z.string().min(1).max(120),
    page_index: z.number().int().min(0),
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().positive(),
    height: z.number().positive(),
    source: fieldSourceSchema,
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
    if (value.source === "booking_response" && !value.question_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["question_id"],
        message: "question_id is required when source is booking_response",
      });
    }
    const dataKeySources = ["property", "unit", "landlord", "agency", "booking", "pm_tenant", "computed"];
    if (dataKeySources.includes(value.source) && !value.data_key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data_key"],
        message: "data_key is required for this source",
      });
    }
    if (value.source === "manual" && !value.manual_key) {
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
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable(),
  portfolio_id: z.string().uuid().nullable(),
  is_active: z.boolean(),
});

export const generateContractSchema = z.object({
  templateId: z.string().uuid(),
  bookingId: z.string().uuid(),
  // When set, stamp this exact contract (e.g. the one approveBooking just
  // created) instead of searching for a draft. Lets the convert-to-tenancy flow
  // attach a PDF to an active contract too.
  contractId: z.string().uuid().optional(),
  manualValues: z.record(z.string(), z.string()),
  contractDefaults: z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    rent_pcm: z.number().int().min(0),
    deposit: z.number().int().min(0),
    collection_date: z.number().int().min(1).max(31).nullable().optional(),
    deposit_scheme: z.enum(["dps", "mydeposits", "tds", "none"]).optional(),
  }),
});

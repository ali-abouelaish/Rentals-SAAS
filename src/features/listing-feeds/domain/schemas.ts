import { z } from "zod";
import { FIELD_BY_KEY } from "./fields";

/**
 * Shared by the client form and every server action. Per CLAUDE.md the server
 * action re-validates with the same schema — client validation is never trusted
 * on its own.
 */

/**
 * The spreadsheet link on a landlord. Optional: a landlord may have a SpareRoom
 * profile, a spreadsheet, both, or neither.
 */
export const spreadsheetUrlSchema = z
  .string()
  .trim()
  .url("Enter a full URL, e.g. https://docs.google.com/spreadsheets/d/…")
  .refine((v) => /^https?:\/\//i.test(v), "The link must start with http:// or https://")
  .optional()
  .or(z.literal(""));

export const columnMapSchema = z
  .record(z.string())
  .refine(
    (map) => Object.values(map).every((field) => field in FIELD_BY_KEY),
    "One of the selected fields is not a recognised listing field"
  )
  .refine((map) => {
    // Two columns writing the same field would make the import order-dependent.
    const used = Object.values(map);
    return new Set(used).size === used.length;
  }, "Two columns are mapped to the same listing field — each field can only be filled once")
  .refine(
    (map) => Object.keys(map).length > 0,
    "Map at least one column before saving"
  );

/**
 * Sheet header names combined to identify a row across reads. Empty is valid —
 * it means "use the default identity chain".
 */
export const keyColumnsSchema = z
  .array(z.string().min(1))
  .max(5, "Combine at most 5 columns — more than that and the key gets fragile")
  .refine((cols) => new Set(cols).size === cols.length, "The same column is selected twice");

/** Payload for saving a reviewed mapping back onto a landlord. */
export const saveMappingSchema = z.object({
  header_row: z.coerce
    .number({ invalid_type_error: "Enter a row number" })
    .int("Whole numbers only")
    .min(1, "Row numbers start at 1")
    .max(50, "The header must be within the first 50 rows"),
  column_map: columnMapSchema,
  key_columns: keyColumnsSchema.default([]),
});

export type SaveMappingValues = z.infer<typeof saveMappingSchema>;

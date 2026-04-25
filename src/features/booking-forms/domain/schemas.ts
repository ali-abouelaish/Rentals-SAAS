import { z } from "zod";

export const bookingFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  portfolio_id: z.string().uuid("Pick a portfolio so bookings route correctly"),
  is_active: z.boolean().default(true),
});
export type BookingFormValues = z.infer<typeof bookingFormSchema>;

const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (typeof val === "string" && val.trim() === "" ? null : val), schema);

export const bankDetailsSchema = z.object({
  label: z.string().min(1, "Give this account a name (e.g. 'Main', 'Deposits')").max(80),
  account_holder_name: emptyToNull(z.string().max(120).nullable().optional()),
  account_number: emptyToNull(
    z
      .string()
      .regex(/^\d{6,8}$/, "Account number must be 6-8 digits")
      .nullable()
      .optional()
  ),
  sort_code: emptyToNull(
    z
      .string()
      .regex(/^\d{2}-?\d{2}-?\d{2}$/, "Sort code must look like 12-34-56")
      .nullable()
      .optional()
  ),
  bank_name: emptyToNull(z.string().max(120).nullable().optional()),
  payment_reference_hint: emptyToNull(z.string().max(240).nullable().optional()),
});
export type BankDetailsValues = z.infer<typeof bankDetailsSchema>;

export const formQuestionSchema = z.object({
  question_text: z.string().min(1, "Content is required"),
  question_type: z.enum([
    "text", "textarea", "email", "phone", "date",
    "select", "checkbox", "file_upload", "number", "info",
  ]),
  options: z.array(z.string()).optional(),
  is_required: z.boolean().default(false),
  sort_order: z.number().default(0),
});
export type FormQuestionValues = z.infer<typeof formQuestionSchema>;

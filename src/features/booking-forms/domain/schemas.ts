import { z } from "zod";

export const bookingFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  portfolio_id: z.string().optional(),
  is_active: z.boolean().default(true),
});
export type BookingFormValues = z.infer<typeof bookingFormSchema>;

export const formQuestionSchema = z.object({
  question_text: z.string().min(1, "Question text is required"),
  question_type: z.enum([
    "text", "textarea", "email", "phone", "date",
    "select", "checkbox", "file_upload", "number",
  ]),
  options: z.array(z.string()).optional(),
  is_required: z.boolean().default(false),
  sort_order: z.number().default(0),
});
export type FormQuestionValues = z.infer<typeof formQuestionSchema>;

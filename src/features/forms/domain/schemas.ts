import { z } from "zod";

export const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  portfolio_id: z.string().uuid().nullable().optional(),
});
export type FormValues = z.infer<typeof formSchema>;

export const formQuestionSchema = z.object({
  question_text: z.string().min(1, "Content is required"),
  question_type: z.enum([
    "text", "textarea", "email", "phone", "date",
    "select", "checkbox", "number", "info", "file", "confirm",
  ]),
  options: z.array(z.string()).optional(),
  is_required: z.boolean().default(false),
  sort_order: z.number().default(0),
});
export type FormQuestionValues = z.infer<typeof formQuestionSchema>;

export const submitFormSchema = z.object({
  respondent_name: z.string().optional(),
  respondent_email: z.string().optional(),
  respondent_phone: z.string().optional(),
  answers: z.array(
    z.object({
      question_id: z.string().uuid(),
      answer_text: z.string().optional(),
    })
  ),
});
export type SubmitFormValues = z.infer<typeof submitFormSchema>;

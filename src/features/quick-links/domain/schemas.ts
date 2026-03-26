import { z } from "zod";

export const quickLinkSchema = z.object({
  title: z.string().min(1, "Title is required").max(60, "Max 60 characters"),
  url: z.string().url("Must be a valid URL"),
  description: z.string().max(120, "Max 120 characters").optional(),
});

export type QuickLinkPayload = z.infer<typeof quickLinkSchema>;

import { z } from "zod";

/** http(s) only — z.string().url() alone accepts javascript: links. */
function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/** The token travels in the request body, so plain http only for local testing. */
function isSignInUrl(value: string): boolean {
  try {
    const { protocol, hostname } = new URL(value);
    if (protocol === "https:") return true;
    return protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

export const quickLinkSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(60, "Max 60 characters"),
    url: z
      .string()
      .trim()
      .max(500, "Max 500 characters")
      .refine(isWebUrl, "Enter a full web address starting with https://"),
    description: z.string().trim().max(120, "Max 120 characters"),
    sso_enabled: z.boolean(),
    sso_callback_url: z.string().trim().max(500, "Max 500 characters"),
  })
  .superRefine((values, ctx) => {
    if (values.sso_enabled && !isSignInUrl(values.sso_callback_url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sso_callback_url"],
        message: "Enter the sign-in address your web developer set up, starting with https://",
      });
    }
  });

export type QuickLinkValues = z.infer<typeof quickLinkSchema>;

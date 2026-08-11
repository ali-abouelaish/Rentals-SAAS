import { z } from "zod";

// SMTP provider configuration. Password may be left blank when editing an
// existing connection (the stored password is kept). Validated on both client
// (RHF) and server (action).
export const smtpProviderSchema = z.object({
  fromAddress: z.string().trim().email("Enter a valid email address"),
  fromName: z.string().trim().max(120, "Max 120 characters").optional().or(z.literal("")),
  replyTo: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
  host: z.string().trim().min(1, "Host is required").max(255, "Max 255 characters"),
  port: z.coerce
    .number({ invalid_type_error: "Port must be a number" })
    .int("Port must be a whole number")
    .min(1, "Port must be 1–65535")
    .max(65535, "Port must be 1–65535"),
  secure: z.boolean(),
  username: z.string().trim().min(1, "Username is required").max(255, "Max 255 characters"),
  // Optional so edits can keep the stored password; the server enforces presence
  // when creating a new connection.
  password: z.string().max(1024, "Max 1024 characters").optional().or(z.literal("")),
});

export type SmtpProviderValues = z.infer<typeof smtpProviderSchema>;

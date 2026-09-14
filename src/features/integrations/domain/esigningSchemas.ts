import { z } from "zod";

/**
 * Requesting a sender identity makes BoldSign email the address a verification
 * link. That is an outward-facing action against a real mailbox, so the form
 * asks for an explicit acknowledgement rather than firing on a bare click —
 * the same reason the integration activation dialog has a checkbox.
 */
export const requestSenderIdentitySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter the email address documents should come from")
    .email("Enter a valid email address")
    .max(254, "That address is too long"),
  displayName: z
    .string()
    .trim()
    .min(2, "Enter the name recipients should see")
    .max(100, "Keep this under 100 characters"),
  acknowledgeVerification: z.literal(true, {
    errorMap: () => ({
      message: "Tick the box to confirm we can email this address to verify it",
    }),
  }),
});

export type RequestSenderIdentityInput = z.infer<typeof requestSenderIdentitySchema>;

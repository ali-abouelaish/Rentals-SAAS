import { z } from "zod";
import { isIntegrationKey } from "@/lib/integrations/catalog";

/**
 * Activation commits the agency to a recurring charge, so the confirmation is
 * an explicit acknowledgement rather than an implied one. Validated on the
 * client (to render the error inline under the checkbox) and again in the
 * server action, because client validation is a courtesy, not a control.
 */
export const activateIntegrationSchema = z.object({
  integrationKey: z
    .string()
    .min(1, "Choose an integration")
    .refine(isIntegrationKey, "That integration does not exist"),
  acceptCharge: z.literal(true, {
    errorMap: () => ({
      message: "Tick the box to confirm you agree to the monthly charge",
    }),
  }),
});

export type ActivateIntegrationInput = z.infer<typeof activateIntegrationSchema>;

export const cancelIntegrationSchema = z.object({
  integrationKey: z
    .string()
    .min(1, "Choose an integration")
    .refine(isIntegrationKey, "That integration does not exist"),
  /**
   * Optional, and capped so a runaway paste cannot fill the column. Fed back to
   * the super-admin billing view, where it is the only signal about why an
   * agency left.
   */
  reason: z
    .string()
    .trim()
    .max(500, "Keep this under 500 characters")
    .optional()
    .or(z.literal("")),
});

export type CancelIntegrationInput = z.infer<typeof cancelIntegrationSchema>;

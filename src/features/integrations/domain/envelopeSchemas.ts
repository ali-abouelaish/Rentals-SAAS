import { z } from "zod";
import { getEnvelopePack } from "@/lib/envelopes/packs";

/**
 * Buying envelopes commits the agency to a charge on its next invoice, so —
 * like activating a paid integration — it takes an explicit acknowledgement
 * rather than a bare click.
 */
export const purchaseEnvelopesSchema = z.object({
  packKey: z
    .string()
    .min(1, "Choose a pack")
    .refine((key) => getEnvelopePack(key) !== null, "That pack doesn't exist"),
  acceptCharge: z.literal(true, {
    errorMap: () => ({
      message: "Tick the box to confirm the charge on your next invoice",
    }),
  }),
});

export type PurchaseEnvelopesInput = z.infer<typeof purchaseEnvelopesSchema>;

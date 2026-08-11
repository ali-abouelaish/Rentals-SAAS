import { z } from "zod";

/**
 * Marketing claim proof rules.
 *
 * Proof files are uploaded straight from the browser to Supabase Storage —
 * they never travel through a Server Action. Pushing several multi-megabyte
 * screenshots through an action means the whole payload has to clear the
 * Server Action body limit *and* the reverse proxy's `client_max_body_size`;
 * when either rejects it, Next has no action result to apply and the failure
 * escapes as an uncaught client error (a blank "Application error" page).
 *
 * So these limits are enforced twice: in the browser before the upload starts,
 * and again on the server when the resulting paths are registered.
 */
export const MAX_PROOF_FILES = 8;
export const MAX_PROOF_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_PROOF_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

/** `accept` for the file input. Extensions are listed too because some mobile
 *  browsers report an empty MIME type for HEIC captures. */
export const PROOF_ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/*,application/pdf";

export const startMarketingClaimSchema = z.object({
  rentalId: z.string().uuid("Missing rental."),
  note: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters.")
    .optional()
    .default(""),
});
export type StartMarketingClaimInput = z.input<typeof startMarketingClaimSchema>;

export const finalizeMarketingClaimSchema = z.object({
  claimId: z.string().uuid("Missing claim."),
  files: z
    .array(
      z.object({
        path: z.string().min(1, "Missing upload path."),
        name: z.string().min(1).max(255),
      })
    )
    .min(1, "Attach at least one screenshot or PDF as proof.")
    .max(MAX_PROOF_FILES, `Attach at most ${MAX_PROOF_FILES} files.`),
});
export type FinalizeMarketingClaimInput = z.infer<typeof finalizeMarketingClaimSchema>;

/** Storage prefix every proof for a claim must sit under. Also the guard the
 *  server uses to reject paths a caller made up. */
export function marketingClaimProofPrefix(
  tenantId: string,
  rentalId: string,
  claimId: string
): string {
  return `${tenantId}/${rentalId}/marketing_claim/${claimId}`;
}

/** Why this file can't be used as proof, or null when it's fine. */
export function proofFileError(file: File): string | null {
  if (file.size > MAX_PROOF_BYTES) {
    return `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB — the limit is 10 MB per file.`;
  }
  if (file.type && !(ALLOWED_PROOF_MIME as readonly string[]).includes(file.type)) {
    return `"${file.name}" isn't a supported file type. Use JPG, PNG, WEBP, HEIC or PDF.`;
  }
  return null;
}

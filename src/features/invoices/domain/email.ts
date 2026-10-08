import { z } from "zod";
import type { MergeField } from "@/features/automations/domain/mergeFields";

/** email_templates.key for the agency's invoice email. */
export const INVOICE_EMAIL_TEMPLATE_KEY = "invoice_send";

/**
 * The starting point every agency gets until they save their own copy on the
 * Billing page. Written in the agency-message markup (see lib/email/blocks.ts):
 * the layout, logo and colours are applied around it at send time.
 */
export const DEFAULT_INVOICE_EMAIL = {
  subject: "Invoice {{invoice_number}} from {{billing_company}}",
  body: `# Invoice {{invoice_number}}

Hi {{landlord_name}},

Please find invoice **{{invoice_number}}** attached for **{{balance_due}}**, due on **{{due_date}}**.

Payment details are on the invoice. If you have any questions, just reply to this email.

Thank you,
{{billing_company}}`,
};

/**
 * The merge-field allowlist for invoice emails. Rendering only substitutes
 * these keys; anything else stays visible and is flagged in the editor.
 */
export const INVOICE_MERGE_FIELDS: MergeField[] = [
  { key: "landlord_name", label: "Landlord name", example: "Alex Landlord" },
  { key: "invoice_number", label: "Invoice number", example: "INV-0042" },
  { key: "total", label: "Invoice total", example: "£1,250.00" },
  { key: "balance_due", label: "Balance due", example: "£1,250.00" },
  { key: "issue_date", label: "Issue date", example: "01 Oct 2026" },
  { key: "due_date", label: "Due date", example: "08 Oct 2026" },
  { key: "billing_company", label: "Billing company", example: "Harbor Lettings Ltd" },
  { key: "agency_name", label: "Agency name", example: "Harbor Lettings" },
];

/** Example values for previewing the template outside any one invoice. */
export const INVOICE_MERGE_EXAMPLES: Record<string, string> = Object.fromEntries(
  INVOICE_MERGE_FIELDS.map((f) => [f.key, f.example])
);

/** Statuses an invoice can be emailed from. Drafts never are. */
export const SENDABLE_INVOICE_STATUSES = ["submitted", "approved", "sent"] as const;

export function isSendableStatus(status: string): boolean {
  return (SENDABLE_INVOICE_STATUSES as readonly string[]).includes(status);
}

export const invoiceEmailSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, "Subject is required")
    .max(200, "Max 200 characters"),
  body: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(10000, "Max 10,000 characters"),
});
export type InvoiceEmailValues = z.infer<typeof invoiceEmailSchema>;

export const invoiceRecipientSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .max(254, "Max 254 characters"),
});
export type InvoiceRecipientValues = z.infer<typeof invoiceRecipientSchema>;

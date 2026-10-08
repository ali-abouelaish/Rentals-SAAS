import type { HelpArticle } from "../domain/types";

export const billingProfilesArticle: HelpArticle = {
  slug: "billing-profiles",
  title: "Billing Profiles",
  route: "/settings/billing-profiles",
  match: "exact",
  summary: "Define the sender, bank, and branding details used on invoices, and the email landlords receive with them.",
  content: `## What this page is for

Billing Profiles hold the details that appear on your invoices — company name and address, contact details, bank account, default payment terms, footer text, and logo. You can keep more than one profile.

## Key tasks

1. **Create a profile.** Fill in the form: profile name, company name, sender address/email/phone, bank account holder/number/sort code, default payment terms (net days), footer text, and an optional **logo**.
2. **Review existing profiles.** The table below lists your saved profiles.
3. **Edit a profile.** Update any profile's details inline.
4. **Delete a profile.** Remove one you no longer use.
5. **Write your invoice email.** The **Invoice email** card at the bottom sets the subject and message landlords receive with every invoice PDF. Click a merge field (such as \`{{invoice_number}}\`, \`{{balance_due}}\`, \`{{due_date}}\`, \`{{landlord_name}}\` or \`{{billing_company}}\`) to insert it, use **Preview** to see the finished branded email with example details, then **Save invoice email**. **Reset to default** goes back to the built-in wording.

## Tips

- These details populate every invoice you raise in [Invoices](/invoices) — keep bank details and the logo current.
- Required fields include the company name, account holder, account number, and sort code.
- The billing profile's **sender email** is used as the reply-to address on invoice emails, so landlord replies reach your accounts inbox.
- The invoice email supports simple formatting: \`# Heading\` for the title, \`## Heading\` for a section, \`- item\` for bullets and \`**bold**\`. Your logo, colours and an invoice details panel are added automatically. Staff can still tweak the wording for a single send.
- To send invoices from your own Outlook / Gmail address instead of the shared Harbor Ops mailer, connect a mailbox in [Email Sending](/settings/email).
- This page is admin-only.`,
};

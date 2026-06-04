import type { HelpArticle } from "../domain/types";

export const billingProfilesArticle: HelpArticle = {
  slug: "billing-profiles",
  title: "Billing Profiles",
  route: "/settings/billing-profiles",
  match: "exact",
  summary: "Define the sender, bank, and branding details used on invoices.",
  content: `## What this page is for

Billing Profiles hold the details that appear on your invoices — company name and address, contact details, bank account, default payment terms, footer text, and logo. You can keep more than one profile.

## Key tasks

1. **Create a profile.** Fill in the form: profile name, company name, sender address/email/phone, bank account holder/number/sort code, default payment terms (net days), footer text, and an optional **logo**.
2. **Review existing profiles.** The table below lists your saved profiles.
3. **Edit a profile.** Update any profile's details inline.
4. **Delete a profile.** Remove one you no longer use.

## Tips

- These details populate every invoice you raise in [Invoices](/invoices) — keep bank details and the logo current.
- Required fields include the company name, account holder, account number, and sort code.
- This page is admin-only.`,
};

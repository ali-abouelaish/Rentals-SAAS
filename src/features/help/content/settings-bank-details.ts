import type { HelpArticle } from "../domain/types";

export const settingsBankDetailsArticle: HelpArticle = {
  slug: "settings-bank-details",
  title: "Bank Details",
  route: "/settings/bank-details",
  match: "exact",
  summary: "Hold per-portfolio bank details for tenant payments.",
  content: `## What this page is for

Bank Details stores the account information tenants pay into, kept **per portfolio** so each one can use the right account. These details are used on booking forms and when reconciling statements.

## Key tasks

1. **Add bank details.** Create a set of bank details for a portfolio.
2. **Set a default.** Mark one set as the default so it's used when a portfolio doesn't have its own.
3. **Edit details.** Update account information as it changes.
4. **Delete details.** Remove a set you no longer need.

## Tips

- These details flow through to [Booking Forms](/settings/booking-forms) and help map uploads in [Bank Statements](/rent-collection/statements) to the right portfolio.
- Keep the default current — it's the fallback whenever a portfolio has no specific account set.`,
};

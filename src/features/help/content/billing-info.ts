import type { HelpArticle } from "../domain/types";

export const billingInfoArticle: HelpArticle = {
  slug: "billing-info",
  title: "Billing info & settings",
  route: "/settings/billing-info",
  match: "exact",
  summary: "Your subscription, billing contact, and email sending settings.",
  content: `## What this page is for

Billing info covers your agency account: your subscription and payment status, your billing/agency contact email, and tools to verify outgoing email.

## Key tasks

1. **Set your agency contact email.** Update the contact address used for your agency in the contact-email card.
2. **Review billing details.** Check your subscription and payment status in the billing form.
3. **Test email delivery.** Use the email test card to send a test message and confirm your reply-to/sending setup works.

## Tips

- The reply-to address comes from your agency's email branding settings.
- Getting outgoing email right here ensures invoices and tenant reminders are delivered reliably.
- This page is admin-only.`,
};

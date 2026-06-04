import type { HelpArticle } from "../domain/types";

export const bonusesArticle: HelpArticle = {
  slug: "bonuses",
  title: "Bonuses",
  route: "/bonuses",
  match: "prefix",
  summary: "Submit, review, and invoice landlord commission bonuses.",
  content: `## What this page is for

Bonuses tracks landlord commission submissions from creation through approval to payment, and lets you turn eligible bonuses into invoices.

## Key tasks

1. **Submit a bonus.** Use **Submit bonus** to record a new landlord commission (admins can submit on behalf of an agent).
2. **Search and filter.** Search by code, client, or property, filter by landlord, and filter by status — Pending, Approved, Sent, Paid, Declined.
3. **Invoice eligible bonuses.** The **Eligible for Invoicing** section lists approved/pending bonuses; select them and create an invoice, or use **Create Invoice** to go to [invoice from bonuses](/invoices/from-bonuses).
4. **Open a bonus.** Click through to review and progress an individual submission.

## Tips

- Only **approved** or **pending** bonuses are eligible for invoicing.
- Each agent's payout reflects their commission share (or the full amount for full-payout bonuses).
- Bonus earnings also show up in [Earnings](/earnings) and [My Profile](/me).`,
};

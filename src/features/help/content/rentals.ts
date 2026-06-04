import type { HelpArticle } from "../domain/types";

export const rentalsArticle: HelpArticle = {
  slug: "rentals",
  title: "Rentals",
  route: "/rentals",
  match: "prefix",
  summary: "Track rental codes through approval, payment, and refund.",
  content: `## What this page is for

Rentals lists every rental code with its client, agent, fee, payment method, and status. It's where you monitor the rental pipeline and (as an admin) move rentals through their lifecycle.

## Key tasks

1. **Create a rental.** Use **Create Rental** — you start from a [client](/clients), then generate the rental code.
2. **Search and filter.** Filter by status (Pending, Approved, Paid, Refunded, Need More Info), by agent, by payment method, and by date range; search by code, client, or agent.
3. **Open a rental.** Click a row to view the full rental detail.
4. **Mark paid / refund (admin).** On an **approved** rental, admins can **Mark as paid** or **Refund** directly from the row.

## Tips

- The list refreshes in real time as rentals are created or updated.
- Paid rentals feed your figures in [Earnings](/earnings).
- Agents see the rentals they're involved in; admins see all and can change status.`,
};

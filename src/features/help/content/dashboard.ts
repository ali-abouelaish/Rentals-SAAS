import type { HelpArticle } from "../domain/types";

export const dashboardArticle: HelpArticle = {
  slug: "dashboard",
  title: "Dashboard",
  route: "/dashboard",
  match: "prefix",
  summary: "Your agency's at-a-glance overview of performance and activity.",
  content: `## What this page is for

The Dashboard is your landing overview. What it shows depends on your module and role:

- **Rental Agency view** — earnings, rentals, and activity for your agency (agents see their own figures; admins see the whole agency).
- **Property Management view** — portfolio profitability, key metrics, and a recent-activity feed.

## Key tasks

1. **Switch module view.** If your agency has both modules and you're an admin, use the **Rental Agency / Property Management** toggle at the top to change which dashboard you see.
2. **Read your headline numbers.** The cards summarise the most important figures for the active view.
3. **Jump to the detail.** Use the dashboard as a springboard — follow through to [Earnings](/earnings), [Rentals](/rentals), or [Profitability](/profitability) for the full breakdown.

## Tips

- Agents see a personal view scoped to their own rentals and earnings; admins see agency-wide totals.
- PM-only agencies always land on the Property Management dashboard; RA-only agencies always see the rental dashboard.`,
};

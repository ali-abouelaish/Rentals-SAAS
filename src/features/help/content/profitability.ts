import type { HelpArticle } from "../domain/types";

export const profitabilityArticle: HelpArticle = {
  slug: "profitability",
  title: "Profitability",
  route: "/profitability",
  match: "prefix",
  summary: "Track property P&L, log costs, set targets, and clear alerts.",
  content: `## What this page is for

Profitability shows the net position of each property — rent income against costs — with a portfolio trend chart and per-property detail. It's where you log costs, set profit targets, and respond to alerts.

## Key tasks

1. **Read the portfolio chart.** The top chart shows portfolio profit over the last 12 months.
2. **Scan the property list.** Each property shows its current profitability so you can spot under-performers.
3. **Open a property's P&L.** Click through to the property detail page for its monthly trend and cost breakdown.
4. **Manage costs.** Add, edit, or delete property costs on the detail page.
5. **Set a target.** Save a profit target for a property so the system can flag when it falls short.
6. **Resolve alerts.** Clear profitability alerts once you've actioned them.

## Tips

- Rent income is derived from active contracts and recorded payments — keep [Contracts](/contracts) and [Rent Collection](/rent-collection) current for accurate figures.
- Maintenance spend logged in [Maintenance](/maintenance) flows into a property's costs.
- Alerts fire when a property drops below its target, so set realistic targets to make them useful.`,
};

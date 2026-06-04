import type { HelpArticle } from "../domain/types";

export const earningsArticle: HelpArticle = {
  slug: "earnings",
  title: "Earnings",
  route: "/earnings",
  match: "prefix",
  summary: "Track earnings, the agent leaderboard, and outstanding payments.",
  content: `## What this page is for

Earnings is your financial overview. Admins see **Agency Earnings** across all agents (totals, leaderboard, per-agent breakdown); agents see **My Earnings** scoped to themselves.

## Key tasks

1. **Set the date range.** Use the filters card to choose the period (defaults to the last 30 days).
2. **Read the stat tiles.** Totals by amount, transactions, rentals closed/pending, top agent, average per agent, and a breakdown by payment method (cash/card/transfer).
3. **Switch tabs.** **Overview** shows charts and the leaderboard; **Payments** shows the outstanding-payments tracker.
4. **Compare agents (admin).** The trend chart can compare the top agents; the **All Agents** table lists everyone.
5. **Track payments.** On the **Payments** tab, filter by paid/unpaid and mark payments as settled.
6. **Export.** Use **Export** to download the transactions for the selected period.

## Tips

- Agents see only their own data plus a top-10 leaderboard; admins see full agency figures.
- Earnings come from [Rentals](/rentals) and [Bonuses](/bonuses), so keep those accurate for correct totals.`,
};

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
- Earnings come from [Rentals](/rentals) and [Bonuses](/bonuses), so keep those accurate for correct totals.

## Manager commission

If your agency has managers (set up from an agent's profile under [Agents](/agents)):

- **Overview (admins):** a **Manager commission** card lists each manager's earned, paid and unpaid totals for the period, plus deals awaiting approval. Click a manager to open their breakdown.
- **A manager's earnings page** has a **Manager commission** section grouped **by agent**. Expand an agent to see each rental or bonus, with:
  - the base (rental net or bonus amount)
  - the percentage
  - the manager's cut
  - for admins, what the agency keeps. A red figure means the agency lost money on that deal.
- **Payments tab:** each manager line is its own row, marked "Manager · rental" or "Manager · bonus". It has its own paid toggle, separate from the agent's.
  - When you mark a line paid, the amount at that moment is recorded, so later edits to the deal won't change what was paid.
  - A line can only be paid once its deal is approved.
- The manager's cut comes out of the agency's share, never the agent's commission. The leaderboard ranks sales only and doesn't include manager commission.`,
};

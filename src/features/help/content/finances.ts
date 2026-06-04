import type { HelpArticle } from "../domain/types";

export const financesArticle: HelpArticle = {
  slug: "finances",
  title: "Finances",
  route: "/finances",
  match: "prefix",
  summary: "Monthly portfolio P&L hub with overheads, charges, and close.",
  content: `## What this page is for

Finances is your portfolio-wide monthly P&L hub. It rolls up rent collected, property costs, owner rent, vacancy loss, and bank reconciliation for a chosen month, and links to the supporting tools: admin overheads, tenant charges, and the monthly close.

## Key tasks

1. **Pick a month.** Use the month selector to see the rollup for that period.
2. **Read the rollup.** Review rent collected, costs, owner rent, vacancy loss, and reconciliation in one place.
3. **Manage admin overheads.** On **Overheads** (\`/finances/overheads\`), record recurring business overheads that sit above individual properties.
4. **Set tenant charges.** On **Tenant Charges** (\`/finances/tenant-charges\`), add recurring charges against active contracts.
5. **Run the monthly close.** On **Monthly Close** (\`/finances/close\`), work the checklist to lock a completed month. The close defaults to the **previous** month — you can't close the current or a future month. A super admin can reopen a closed month.

## Tips

- Figures here draw on [Rent Collection](/rent-collection), property costs in [Profitability](/profitability), and [Contracts](/contracts) — keep those current for an accurate P&L.
- Closing a month locks it; reopening is restricted to super admins.
- This feature requires the **Finances** entitlement and the Property Management module.`,
};

import type { HelpArticle } from "../domain/types";

export const rentCollectionArticle: HelpArticle = {
  slug: "rent-collection",
  title: "Rent Collection",
  route: "/rent-collection",
  match: "prefix",
  summary: "Record rent payments and watch lifetime arrears across tenancies.",
  content: `## What this page is for

Rent Collection lists every active tenancy with what's expected, what's been paid, and the resulting arrears — so you can record payments and keep on top of who owes what across the whole portfolio.

## Key tasks

1. **Read the headline stats.** The cards show lifetime **Expected**, **Paid**, **Arrears**, and the number of **Tenancies owing**. Arrears turn red when there's a balance.
2. **Record a payment.** On a tenancy's row, record the rent received for a period; the totals and arrears update accordingly.
3. **Undo a payment.** If you record one in error, undo it from the same row.
4. **Open Bank Statements.** Use **Bank Statements** to go to [statement uploads](/rent-collection/statements) for bulk reconciliation.

## Tips

- Only **active or signed** contracts appear here — if a tenancy is missing, check its status in [Contracts](/contracts).
- Arrears are calculated over the lifetime of the tenancy, not just the current month.
- For high volumes, upload a bank statement and reconcile instead of recording each payment by hand.`,
};

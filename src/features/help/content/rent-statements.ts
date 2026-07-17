import type { HelpArticle } from "../domain/types";

export const rentStatementsArticle: HelpArticle = {
  slug: "rent-statements",
  title: "Bank Statements",
  route: "/rent-collection/statements",
  match: "prefix",
  summary: "Upload bank statements and reconcile them against expected rent.",
  content: `## What this page is for

Bank Statements lets you upload a portfolio's bank statement and reconcile the transactions against expected rent, so payments are matched in bulk and any mismatches are flagged for review.

## Key tasks

1. **Upload a statement.** Choose the portfolio and upload its statement file. The system parses the transactions and attempts to match them to expected rent.
2. **Review uploads.** See your previous uploads and their reconciliation results.
3. **Resolve flags.** Where a transaction couldn't be matched cleanly, it's flagged — work through the flags and resolve each one.
4. **Delete an upload.** Remove an upload if it was wrong or a duplicate.

## How matching works

- **Exact reference (best).** Every tenancy has a unique **standing order reference** (e.g. \`MAPL-SMITH-7K9Q\`). When that reference appears in a payment, the credit is matched straight to that tenancy — no guessing. If the reference matches but the amount differs from the expected rent, the payment is **flagged** for you to review rather than matched silently.
- **Name + amount (fallback).** When no reference is found, the system falls back to matching on the payer's name and an amount close to the expected rent.
- To make payments reconcile exactly, give each tenant their standing order reference (shown on the tenancy in [Tenancies](/contracts), and available as a merge field on your tenancy-agreement template) and ask them to use it on their standing order.

## Tips

- Reconciliation feeds the same figures shown in [Rent Collection](/rent-collection).
- This page requires the Rent Collection feature to be enabled for your agency.
- Keep per-portfolio [Bank Details](/settings/bank-details) accurate so statements map to the right portfolio.`,
};

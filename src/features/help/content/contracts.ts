import type { HelpArticle } from "../domain/types";

export const contractsArticle: HelpArticle = {
  slug: "contracts",
  title: "Contracts",
  route: "/contracts",
  match: "prefix",
  summary: "Manage tenancy contracts, deposit protection, notices, and rent.",
  content: `## What this page is for

Contracts tracks every tenancy agreement — its term, rent, deposit and deposit-protection status, and lifecycle from draft to active to closed. It's the backbone that feeds rent collection and profitability.

## Key tasks

1. **Create a contract.** Add a contract against a unit and tenant, with the start date, rent, and deposit details.
2. **Open a contract.** Use the contract drawer to review and **update** its details and deposit-protection tracking.
3. **Give notice.** Record a notice on an active tenancy with the relevant dates.
4. **Upload documents.** Attach the signed agreement and related files to the contract.
5. **Close out a contract.** When a tenancy ends, run **closeout** to record the final state (and free up the unit).
6. **Record rent.** Record rent payments and view estimated arrears for the contract's unit — these also surface in [Rent Collection](/rent-collection).

## Standing order reference

Every tenancy is assigned a unique **standing order reference** (e.g. \`MAPL-SMITH-7K9Q\`) shown on the contract's Overview tab, with a copy button. Give it to the tenant to use as the reference on their rent standing order: when it appears on a [Bank Statement](/rent-collection/statements) the payment reconciles straight to this tenancy instead of relying on a name-and-amount guess. It's also available as a merge field ("Standing order reference") on your tenancy-agreement template, so the signed agreement can tell the tenant exactly what to enter.

## Tips

- Converting an application in [Bookings](/bookings) creates the contract for you — as a **draft** (room booked) or **active** (room occupied), depending on whether the tenant has signed and paid.
- Keep deposit-protection details current; the contract tracks them so you can stay compliant.
- Active and signed contracts are what populate [Rent Collection](/rent-collection) and rent income in [Profitability](/profitability).`,
};

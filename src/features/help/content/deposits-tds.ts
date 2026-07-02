import type { HelpArticle } from "../domain/types";

export const depositsTdsArticle: HelpArticle = {
  slug: "deposits-tds",
  title: "TDS Deposit Protection",
  route: "/deposits",
  match: "prefix",
  summary:
    "Register tenancy deposits with the Tenancy Deposit Scheme (TDS Custodial), track the DAN, download DPC certificates, and raise repayment requests.",
  content: `## What this page is for

The Deposits page is where you protect tenancy deposits with your connected schemes. If your agency is set up with **TDS (Tenancy Deposit Scheme, Custodial)**, its deposits appear under the **TDS** subtab. Each card shows the deposit's status, its **DAN** (deposit account number) once created, and the actions available.

## How TDS registration works

1. **Set the scheme on the contract.** Open a [contract](/contracts), edit its deposit details, and set the **Deposit scheme** to *Tenancy Deposit Scheme (TDS)*.
2. **Register with TDS.** From the contract's Deposit tab, choose **Register with TDS**. A wizard collects everything TDS needs — the property address, tenancy dates, deposit amount and the date it was received, the lead tenant (plus any joint tenants and guarantors), and the landlord's details and address. Fields are pre-filled from the contract where possible.
3. **Wait for the DAN.** TDS processes registrations asynchronously. Harbor Ops submits the request, then polls TDS automatically until the deposit is **Protected** and a DAN is issued. The DAN is written back onto the contract's scheme reference.

## Statuses

- **Submitted / Pending** — the registration is queued at TDS and being processed.
- **Protected** — TDS created the deposit and issued a DAN.
- **Failed** — TDS rejected the registration; the reason is shown on the card. Fix the details on the contract and register again.
- **Error** — a connection problem prevented the last status check; it will retry.

## After a deposit is protected

- **DPC certificate.** Download the Deposit Protection Certificate PDF straight from the card.
- **Repayment request.** Raise a repayment against the deposit, splitting the amount between the tenant(s) and an agent breakdown (cleaning, rent arrears, damage, redecoration, gardening, other). The breakdown must add up to the agent total — Harbor Ops calculates the total for you and validates it.

## Tips

- TDS credentials are configured once per agency by your Harbor Ops administrator. If the TDS subtab says *not configured*, ask them to add the agency's TDS member, branch and API key.
- Registration is safe to retry — a deposit that already has a batch reference will not be duplicated.
- Deposit protection is time-sensitive; the contract tracks the protection deadline so you stay compliant.`,
};

import type { HelpArticle } from "../domain/types";

export const depositsDpsArticle: HelpArticle = {
  slug: "deposits-dps",
  title: "DPS Deposit Protection",
  route: "/deposits",
  match: "prefix",
  summary:
    "Register tenancies with the Deposit Protection Service (DPS), pay deposits by bank transfer with auto-allocation, and record protection once confirmed.",
  content: `## What this page is for

The Deposits page is where you protect tenancy deposits with your connected schemes. If your agency is set up with **DPS (the Deposit Protection Service)**, its deposits appear under the **DPS** subtab. Each card shows the deposit's status, its **DPS deposit ID** once registered, and the actions available.

## How DPS registration works

1. **Set the scheme on the contract.** Open a [contract](/contracts), edit its deposit details, and set the **Deposit scheme** to *Deposit Protection Service (DPS)*.
2. **Register with DPS.** From the contract's Deposit tab, choose **Register with DPS**. A wizard collects what DPS needs — the tenancy address (England and Wales postcodes only), start date and length in months, rent and deposit amounts, the date the tenant paid the deposit, and up to 10 tenants (each needs an email or a UK mobile). Fields are pre-filled from the contract where possible.
3. **Get the deposit ID instantly.** DPS responds immediately with a deposit ID, and the tenancy sits at **Awaiting payment** on the agency's DPS account. The ID is written back onto the contract's scheme reference.

## Paying the deposit

Registering the tenancy does **not** move any money. Two ways to pay:

- **DPS portal** — log in to the agency's DPS account and pay there.
- **Bank transfer** — choose **Bank transfer** on the deposit card and enter an allocation reference (up to 18 letters/numbers). DPS returns a **payment reference**; make the bank transfer with that reference and DPS auto-allocates it. Use the same allocation reference across several deposits to cover them with a single transfer.

## Confirming protection

DPS does not tell Harbor Ops when the money lands, so once the deposit shows as protected in the DPS portal, click **Confirm protected** on the card. This records the protection date on the contract and completes the compliance trail.

## Statuses

- **Awaiting payment** — registered with DPS; deposit money not yet sent.
- **Awaiting transfer** — marked for bank transfer; pay using the payment reference shown.
- **Protected** — protection confirmed by your team from the DPS portal.
- **Failed** — DPS rejected the registration; the reasons are shown field by field. Fix the details and register again.
- **Error** — a connection problem interrupted the last attempt; it is safe to retry.

## Tips

- DPS credentials (client ID, client secret, and the agency's 7-digit Agent/Landlord ID) are configured once per agency by your Harbor Ops administrator under Deposit Schemes. If the DPS subtab says *not configured*, ask them to add the keys.
- Registration is safe to retry — a tenancy that already has a DPS deposit ID will not be duplicated.
- The date the deposit was paid must be **before the tenancy start date** and cannot be in the future — DPS enforces both.
- DPS only accepts tenancies in **England and Wales** (the postcode is validated). Scottish or Northern Irish properties need a different scheme.`,
};

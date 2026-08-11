import type { HelpArticle } from "../domain/types";

export const ownerStatementsArticle: HelpArticle = {
  slug: "owners",
  title: "Landlords & Statements",
  route: "/owners",
  match: "prefix",
  summary:
    "Property owners: their details, fee and properties — plus monthly statements showing rent owed less fees and costs.",
  content: `## What this page is for

**Landlords** is where the owners of the properties you manage live. Open a landlord to see their contact details, the management fee you charge them, the properties they own, and every statement you have produced for them.

> This is a different list from **Landlords** in the rental-agency module. That one is your CRM of people you rent *from*; this one is the owners you manage *for*.

## The landlord list

Each row shows how many properties they own, their fee, their most recent statement and its closing balance. An **unsent** badge means a statement has been generated but not yet emailed — that's your worklist.

## The landlord page

- **Overview** — contact details, postal address (statements are addressed to it), internal notes, the management fee, and contract dates with 60/30-day renewal alerts.
- **Properties** — every property whose Ownership is set to this landlord, with occupancy.
- **Statements** — generate a new statement and browse past ones.

A landlord is linked to a property through the property's **Ownership** section. If a landlord shows no properties, that link hasn't been set yet.

## Setting the management fee

The fee is the landlord's standing deal, set on their Overview tab:

- **None** — landlord pays nothing / rent-to-rent.
- **Percentage of rent due** — e.g. 10% of the rent owed on their properties for the period.
- **Flat monthly amount** — a fixed £ per month, charged in full regardless of the rent due.

You can also change the fee on a **single statement** without touching this — see below.

## Generating a statement

1. Open the landlord, go to **Statements**, pick a **month** and choose **Generate draft**.
2. The statement pulls the **rent owed** on each of their properties, **rechargeable maintenance costs** (from [Maintenance](/maintenance)) and computes the **management fee**.
3. Review it, adjust the fee or the costs, add any lines by hand.
4. **Preview PDF**, then **Send to landlord** to email it. Sending locks the statement so the figures can't change afterwards.

## Where the rent figure comes from

Rent on a statement is the **monthly rent owed** recorded on each property — the amount you agreed to pay that landlord — as one line per property, dated to the end of the month.

It is deliberately **not** built from what tenants actually paid. A landlord is only concerned with property-level figures; who paid which room, when, and which rooms sat void is your business, not theirs. Under a rent-to-rent deal you owe the agreed rent whether or not the rooms are let, so voids and arrears stay on your side in [Finances](/finances) — where the matching cost uses this same figure.

If a property has no monthly rent owed recorded, it contributes nothing and the statement says so. Set it on the property, then **Regenerate**.

> Properties paid quarterly, biannually or annually are converted to a monthly figure automatically, matching how Finances treats the same number.

## Which maintenance costs get charged

Every maintenance cost has a **Charge to the landlord** switch, on by default. Untick it for tenant-fault damage or work your agency absorbs, and the cost never reaches a statement.

You can flip it either way from the cost itself or straight from the statement — both write to the same switch, so a cost you exclude stays excluded when you regenerate. Costs you have absorbed appear on the statement under **Not charged to the landlord**, so nothing is silently dropped.

## Adjusting the fee for one month

Use **Edit** next to the management fee on a statement to change it for that period only — a void month, a discount while works run, a one-off flat charge. The landlord's standing deal is left alone unless you tick *also make this the landlord's standing fee*. Statements already sent are never changed.

## Reading the summary

- **Opening balance** — what you were still holding for them at the start of the month.
- **Net for the period** — rent due less the fee, works and other deductions. What this month earned them.
- **Closing balance** — opening plus the net, less anything you have already paid out and any manual corrections. It becomes next month's opening balance.

## Automatic monthly drafts

On the 1st of each month a background job generates **draft** statements for the month that just ended, for every landlord with at least one property. Nothing is emailed automatically — you review each draft and send it yourself.

## Tips

- **Regenerate** re-pulls rent, works and the fee from source data while keeping lines you added by hand. Use it if you record a payment or add a cost after generating.
- **Voiding** a statement recalculates the ones after it, so their opening balances stay correct.
- A landlord can't be deleted while they still have statements — those are a financial record.
- Keep each property's **monthly rent owed** and its [Maintenance](/maintenance) costs up to date; that's where the statement figures come from.
- This feature requires the **Landlords & Statements** entitlement and the Property Management module.`,
};

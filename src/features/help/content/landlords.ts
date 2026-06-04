import type { HelpArticle } from "../domain/types";

export const landlordsArticle: HelpArticle = {
  slug: "landlords",
  title: "Landlords",
  route: "/landlords",
  match: "prefix",
  summary: "Maintain landlord partners, contacts, and commission terms.",
  content: `## What this page is for

Landlords holds your landlord partners — their contacts, listings, and whether they pay commission (and on what terms). It's the partner side of your rental business.

## Key tasks

1. **Add a landlord.** Use **Create landlord** to add a new partner and their details.
2. **Search and filter.** Search by name, contact, or email, and filter by **Paying** / **Not Paying** commission.
3. **Open a landlord.** Click a row to view and edit the landlord's full record and listings.
4. **See commission at a glance.** Each row shows whether they pay commission and the agreed amount or terms.

## Tips

- Commission terms set here flow into [Bonuses](/bonuses) and invoicing.
- Use the paying/not-paying filter to quickly find partners to chase or onboard.`,
};

import type { HelpArticle } from "../domain/types";

export const sharesArticle: HelpArticle = {
  slug: "shares",
  title: "Property Shares",
  route: "/shares",
  match: "prefix",
  summary: "Create public, token-gated links to share live inventory externally.",
  content: `## What this page is for

Property Shares lets you publish a secure, token-gated link that shows external partners a live, filtered view of your unit inventory — including images, commission, and tenant contact where relevant. The list shows each link's scope, statuses included, commission, state (active/expired/revoked), view count, and creation date.

## Key tasks

1. **Create a share.** Click **New share** and set its **name**, **scope** (all properties, a portfolio, or specific properties), which **availability statuses** to include, a **commission override**, and an optional expiry.
2. **Open a share.** Click a row to view the share, copy its public link, and update its settings.
3. **Revoke a share.** Revoke a link to immediately disable external access without deleting its record.
4. **Track engagement.** The **Views** column shows how many times each link has been opened.

## Tips

- Links are token-gated and public — anyone with the URL can view the filtered inventory, so revoke when an engagement ends.
- The inventory shown stays **live**: as unit statuses change in [Properties](/properties), the shared view updates.
- Use the commission override to present partner-specific terms without changing your internal records.`,
};

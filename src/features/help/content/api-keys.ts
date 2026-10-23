import type { HelpArticle } from "../domain/types";

export const apiKeysArticle: HelpArticle = {
  slug: "api-keys",
  title: "API Keys",
  route: "/settings/api-keys",
  match: "exact",
  summary: "Issue API keys so external platforms can read your listings.",
  content: `## What this page is for

API Keys lets you issue and manage keys that allow external platforms to read your data (such as your scraped listings) over HTTPS.

## Key tasks

1. **Issue a key.** Create a new API key for an integration or partner platform. Keys created here can read your listings.
2. **Manage keys.** Review your existing keys, see when each was last used, and revoke any you no longer trust or need.

## Tips

- Treat keys like passwords: share them only with platforms you trust, and revoke one immediately if it's exposed.
- To send enquiries from **your own website** into Leads, don't create a key here. Connect the website under [Leads → Settings](/leads/settings) instead; those keys can only add leads and show here as "Send website leads".
- This feature requires the **Public API** entitlement; without it the page redirects to the dashboard.
- This page is admin-only.`,
};

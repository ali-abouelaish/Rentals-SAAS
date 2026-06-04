import type { HelpArticle } from "../domain/types";

export const upgradeArticle: HelpArticle = {
  slug: "upgrade",
  title: "Upgrade required",
  route: "/upgrade",
  match: "prefix",
  summary: "This feature isn't part of your current plan.",
  content: `## What this page is for

You've landed here because the feature you tried to open isn't included in your agency's current plan.

## What to do

1. **Upgrade your subscription.** Contact your account owner or administrator to add the module you need.
2. **Check what you have.** Admins can review the agency's billing and account status under [Billing info](/settings/billing-info).
3. **Go back.** Use the sidebar to return to a feature your plan includes.

## Tips

- Feature access is controlled per agency; an admin or your provider enables additional modules.`,
};

import type { HelpArticle } from "../domain/types";

export const generalArticle: HelpArticle = {
  slug: "general",
  title: "Getting around",
  route: "/",
  match: "prefix",
  summary: "How this workspace is organised and where to find things.",
  content: `## What this is

This is your agency workspace. The **left sidebar** is your main navigation; the **top bar** holds global search and this Help button. Click **Help** on any page to get a guide written specifically for that screen.

## Key things to know

1. **Navigate from the sidebar.** It groups the tools available to your agency. Depending on your plan you'll see the **Rental Agency** tools (clients, rentals, landlords, bonuses, invoices, earnings) and/or the **Property Management** tools (properties, bookings, tenants, contracts, rent, maintenance).
2. **Search globally.** Use the search box in the top bar to jump straight to records across the workspace.
3. **Switch modules.** If your agency has both modules, admins can switch the dashboard between **Rental Agency** and **Property Management** views with the toggle on the [Dashboard](/dashboard).
4. **Get page help anywhere.** The **Help** button stays in the top bar on every page — open it whenever you're unsure what a screen does.
5. **Manage your account.** Update your profile, avatar, and security from [My Profile](/me).

## Tips

- What you see depends on your **role** (admin vs agent) and your agency's enabled features — some items are admin-only.
- Most list pages share the same pattern: a search/filter bar at the top, a paginated list, and a detail view or drawer when you click a row.`,
};

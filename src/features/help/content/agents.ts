import type { HelpArticle } from "../domain/types";

export const agentsArticle: HelpArticle = {
  slug: "agents",
  title: "Agents",
  route: "/agents",
  match: "prefix",
  summary: "Manage your agent roster, roles, commission, and performance.",
  content: `## What this page is for

Agents is the admin directory of your team. It ranks agents by performance and shows each one's role, rentals, earnings, commission rate, and last activity.

## Key tasks

1. **Add an agent.** Use **Create agent** to invite/add a team member.
2. **Search, filter, and sort.** Search by name, filter by role (Admin, Agent, Marketing Only), and sort by earnings or rentals.
3. **Open an agent.** Click a row to view the agent's profile, adjust their commission, and review their performance.
4. **Read the leaderboard.** The table is ranked, so you can see top and bottom performers at a glance.

## Tips

- Performance figures (rentals, earnings, last active) are drawn from the same data as [Earnings](/earnings).
- Commission percentage set here determines each agent's share of rentals and bonuses.
- This page is admin-only.`,
};

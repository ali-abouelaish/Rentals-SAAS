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
- This page is admin-only.

## Commission settings (VAT)

The **Commission settings** card at the top of the page has one switch: **Deduct VAT from rentals before commission** (on by default).

- **On:** card and transfer rentals have 20% VAT taken off before commission is worked out. A £600 transfer becomes £500, and a 40% agent earns £200.
- **Off:** commission is worked out on the fee after the card machine fee only. The same £600 transfer stays £600, and the agent earns £240.
- Cash rentals never have VAT deducted, and neither do bonuses.
- **It affects new rentals and rentals still awaiting approval.** Approving a rental locks in the setting at that moment, so approved and paid earnings never change when you flip the switch.
- It applies to agent commission and manager commission alike.

## Manager commission

Any agent or admin can be made a **manager** who earns a percentage on the deals closed by a pool of agents. Open the person's profile and use the **Manager commission** card (admins only).

1. **Set up as manager.** Choose:
   - the **percentage**
   - what it **applies to**: rentals only, bonuses only, or both
   - the **agents in the pool**
   - the **start date**
2. **How it's worked out.** The percentage is taken on each rental's net (after card fee and VAT where it applies) or each bonus amount. Example: a £600 transfer is £500 net, so a 10% manager earns £50.
   - **Different cut per agent.** Under **Percentage per agent** you can give any agent in the pool their own rate, e.g. 10% on most of the team but 5% on a senior agent. Leave an agent blank to use the manager's default percentage.
3. **Who pays for it.** The cut comes out of the **agency's share**; the agent's own commission never changes. It isn't capped, so if an agent's commission is very high the agency can lose money on a deal. Admins see this as a red "Company keeps" figure.
4. **Changing terms.** **Change terms** starts new settings from a date you choose. Deals before that date keep the old percentage, scope and pool, so past earnings are never rewritten.
5. **One manager per agent.** Adding an agent who is already in another manager's pool moves them across from the start date. Their earlier deals stay with the old manager.
6. **Ending it.** **End manager role** stops earnings after a chosen last day. Everything earned up to then stays.

Managers show a **Manager** badge in the agents list. Their earnings appear on their [Earnings](/earnings) profile, grouped by agent.`,
};

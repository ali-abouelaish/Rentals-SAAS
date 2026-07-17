import type { HelpArticle } from "../domain/types";

export const dashboardArticle: HelpArticle = {
  slug: "dashboard",
  title: "Dashboard",
  route: "/dashboard",
  match: "prefix",
  summary: "Your agency's at-a-glance overview of performance and activity.",
  content: `## What this page is for

The Dashboard is your landing overview. What it shows depends on your module and role:

- **Rental Agency view** — earnings, rentals, and activity for your agency (agents see their own figures; admins see the whole agency).
- **Property Management view** — portfolio profitability, key metrics, and a recent-activity feed.

## Key tasks

1. **Switch module view.** If your agency has both modules and you're an admin, use the **Rental Agency / Property Management** toggle at the top to change which dashboard you see.
2. **Read your headline numbers.** The cards summarise the most important figures for the active view.
3. **Track your tasks.** On the Property Management dashboard, use the **To-do list**: press **Add task** to open the form, enter what needs doing, an optional due date, and optionally link it to a property. Tick a task off when it's done, or delete it with the trash icon.
4. **Jump to the detail.** Use the dashboard as a springboard — follow through to [Earnings](/earnings), [Rentals](/rentals), or [Profitability](/profitability) for the full breakdown.

## The to-do list

- Only on the **Property Management** dashboard.
- The add form stays tucked behind the **Add task** button — press it to expand the form, then it collapses again once you add the task.
- Each task can be **Personal** (only you can see it) or **Team** (shared with everyone in your agency, who can also tick it off). Team tasks show who added them.
- A due date shows as **Today**, **Tomorrow**, a date, or turns red and says **overdue** once it's past.
- Overdue and soonest-due tasks sort to the top; tasks you tick off drop to a **Completed** section on the board.
- **Completed tasks clear off the board automatically each day** (around 3 AM). You can also clear them immediately with **Clear done**. Cleared tasks aren't deleted — they move to **Completed history**, a read-only audit you can expand at the bottom of the list showing what was done, when, and (for team tasks) by whom.

## Tips

- Agents see a personal view scoped to their own rentals and earnings; admins see agency-wide totals.
- PM-only agencies always land on the Property Management dashboard; RA-only agencies always see the rental dashboard.`,
};

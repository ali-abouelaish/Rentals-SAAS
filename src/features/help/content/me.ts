import type { HelpArticle } from "../domain/types";

export const meArticle: HelpArticle = {
  slug: "me",
  title: "My Profile",
  route: "/me",
  match: "prefix",
  summary: "Your personal performance, earnings, and profile/security settings.",
  content: `## What this page is for

My Profile is your personal home: your headline stats, your earnings and rentals over a date range, your bonuses, and your account settings — all scoped to you.

## Key tasks

1. **Set the date range.** Use the date filter to change the period for the stats, chart, and tables (defaults to the last 30 days).
2. **Switch tabs.** **Overview** combines everything; **Earnings**, **Rentals**, and **Bonuses** drill into each; **Settings** holds your account.
3. **Review your numbers.** See total and period earnings, rentals, average per rental, your transactions, and your bonuses (with your commission share applied).
4. **Edit profile & security.** On the **Settings** tab, update your display name, avatar, phone, contact email, and social links.
5. **Share your card.** If your agency has the digital business card enabled, your public card link is available from the profile header.

## Tips

- Bonus figures here apply your commission percentage, so they reflect your actual share.
- For agency-wide earnings and the leaderboard (admins), use [Earnings](/earnings) instead.`,
};

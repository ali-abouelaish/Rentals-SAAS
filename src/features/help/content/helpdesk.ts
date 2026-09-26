import type { HelpArticle } from "../domain/types";

export const helpdeskArticle: HelpArticle = {
  slug: "helpdesk",
  title: "Contact Support",
  route: "/helpdesk",
  match: "prefix",
  summary: "Raise a support ticket with the Harbor Ops team and follow the reply thread.",
  content: `## What this page is for

Contact Support is how you reach the Harbor Ops team from inside the app — for bugs, billing and account questions, feature requests, or "how do I…?" help. Every request becomes a ticket with a reference like **SUP-2026-000123**, a status, and a reply thread. Anyone on your team can raise tickets, and each person only sees the tickets they raised themselves.

## Key tasks

1. **Raise a ticket.** Click **New ticket**, give it a short subject, pick a category and priority, and describe what happened, what you expected, and how to reproduce it. Attach up to 5 screenshots or files (images, PDF, TXT or CSV, 10 MB each).
2. **Choose the right priority.** Use **Urgent** only when your agency can't operate — for example nobody can sign in. **High** means it's blocking part of your work; **Normal** is right for most questions.
3. **Follow up.** Open a ticket to see the full thread. Add more detail or answer our questions in the reply box — you can attach files there too. We're emailed straight away.
4. **Watch for replies.** When we reply you get an email, and a red dot marks the ticket in the list until you open it. A status of **Waiting on you** means we need an answer before we can continue; replying re-opens it automatically.
5. **After it's fixed.** Resolved tickets can still be re-opened by replying. **Closed** tickets can't — raise a new ticket instead.

## Tips

- A screenshot including any error message is the fastest way for us to diagnose a problem.
- We automatically record the last page you visited before opening Contact Support, plus your browser version, so you don't need to type them. For the best context, go to the page with the problem first, then open Contact Support.
- Reply on the ticket page rather than to the email, so your answer is kept with the ticket.
- Your agency admins can't see your tickets — if a colleague needs to follow along, share the reference number with them.
`,
};

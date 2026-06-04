import type { HelpArticle } from "../domain/types";

export const assistantArticle: HelpArticle = {
  slug: "assistant",
  title: "AI Assistant",
  route: "/assistant",
  match: "prefix",
  summary: "Ask plain-English questions about your portfolio and operations.",
  content: `## What this page is for

The AI Assistant is an admin-only chat that answers questions about your agency's data — properties, tenants, contracts, rent, finances, bookings, and leads. It reads your data to answer; it does **not** make changes.

## Key tasks

1. **Ask a question.** Type a question in the chat, e.g. "Which tenancies are in arrears?" or "How many units are vacant this month?" and the assistant answers from your live data.
2. **Manage conversations.** Use the sidebar to start a new conversation or switch between previous ones; each keeps its own history.
3. **Follow up.** Ask follow-up questions in the same thread to refine or dig deeper.

## Tips

- The assistant is **read-only** — it can answer and summarise but won't edit records. Make changes on the relevant page (e.g. [Rent Collection](/rent-collection) or [Contracts](/contracts)).
- It only sees your own agency's data.
- This feature requires the **AI Assistant** entitlement and the Property Management module; it's admin-only.`,
};

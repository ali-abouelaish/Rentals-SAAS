import type { HelpArticle } from "../domain/types";

export const inboxArticle: HelpArticle = {
  slug: "inbox",
  title: "Inbox",
  route: "/inbox",
  match: "prefix",
  summary: "Review and action communication requests submitted by your tenants.",
  content: `## What this page is for

The Inbox collects requests your tenants raise from their preferences page — for example **email changes**, **alternative format** requests, **data access** requests, and anything filed as **other**. Each one is a small piece of work for your team to action and close out. A badge on the sidebar shows how many are still pending.

## Key tasks

1. **Filter the list.** Use the chips at the top — **Pending**, **Completed**, **Declined**, or **All** — to focus on what needs attention. The view defaults to Pending.
2. **Open a request.** Click **Open** on any row to see the full details, including the tenant, the request type, and any payload (such as the current and requested email).
3. **Approve an email change.** For email-change requests, use **Approve & update email**. This updates the tenant's email to the requested address and resets their email status to active, so future rent reminders go to the new address.
4. **Mark other requests as completed.** For non-email requests, add optional **resolution notes** (kept for audit) and click **Mark as completed**.
5. **Decline a request.** Use **Decline** and enter a brief reason. The reason is stored for audit only — it is **not** sent to the tenant.

## Tips

- Requests originate from the tenant-facing preferences page, so you don't create them here — you only resolve them.
- Resolution notes and decline reasons are an internal audit trail; tenants don't see them.
- You can jump to a tenant's reminder history from their record under [Tenants](/tenants).`,
};

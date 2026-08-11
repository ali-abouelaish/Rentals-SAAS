import type { HelpArticle } from "../domain/types";

export const emailSendingArticle: HelpArticle = {
  slug: "email-sending",
  title: "Email Sending",
  route: "/settings/email",
  match: "exact",
  summary: "Connect your own mailbox so tenant-facing emails send from your agency's address.",
  content: `## What this page is for

Email Sending lets you connect your agency's own mailbox so tenant-facing emails — including rent reminders — are sent from your address instead of the default Harbor Ops mailer. Three options are supported:

- **Microsoft 365 (Outlook)** — sign in with Microsoft and grant permission to send.
- **Google Workspace (Gmail)** — sign in with Google and grant permission to send.
- **Custom SMTP** — enter your own SMTP host, port and credentials.

## Key tasks

1. **Connect a mailbox.** For Microsoft/Google, sign in and consent — we store only an encrypted token, never your password. For SMTP, fill in the form; we test the connection before saving.
2. **Send a test email.** After connecting, send a test to the connected address to confirm sending works end-to-end.
3. **Reconnect / edit / disconnect.** If a connection stops working it is flagged "Needs attention" and you'll be emailed. Reconnect (OAuth) or edit the settings (SMTP) to fix it. Disconnecting reverts to the default Harbor Ops mailer.

## How it works

- When a mailbox is connected and healthy, rent reminders and other tenant-facing mail send from it.
- **If a send fails, it automatically falls back to the default Harbor Ops mailer** so the email still goes out, and your connection is flagged so you can fix it.
- A daily health check verifies each connection before the morning rent-reminder run and alerts you if it has stopped working, so token expiry never fails silently.

## Tips

- This page is admin-only.
- Password resets, portal invites and Harbor Ops system notifications always use the default mailer regardless of this setting.`,
};

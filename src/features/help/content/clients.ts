import type { HelpArticle } from "../domain/types";

export const clientsArticle: HelpArticle = {
  slug: "clients",
  title: "Clients",
  route: "/clients",
  match: "prefix",
  summary: "Your client CRM — capture, track, and progress prospective renters.",
  content: `## What this page is for

Clients is your CRM for prospective renters. It lists every client with their status, lets you capture new ones (including via a QR code), and is the starting point for creating a rental.

## Key tasks

1. **Add a client.** Use **Create client** to add one manually.
2. **Capture via QR.** Share the QR code / public lead link so prospects can submit their own details straight into your list.
3. **Search and filter.** Search by name or phone, and filter by status — **Pending**, **On Hold**, **Solved**, **Registered**, or **All**.
4. **Open a client.** Click a client to open their detail page, where you progress them and create a rental.
5. **Page through results.** Use pagination at the bottom for large lists.

## Tips

- The list updates in real time as new clients (e.g. from the QR link) come in.
- Admins also see which agent each client is assigned to.
- Creating a rental for a client links through to [Rentals](/rentals).`,
};

import type { HelpArticle } from "../domain/types";

export const maintenanceArticle: HelpArticle = {
  slug: "maintenance",
  title: "Maintenance",
  route: "/maintenance",
  match: "prefix",
  summary:
    "Create work orders (with or without a tenant ticket), triage tenant tickets, track costs, and manage your preferred supplier directory.",
  content: `## What this page is for

Maintenance brings together **work orders** (the jobs you run on a property), **tickets** raised by tenants, and your **preferred suppliers** directory. Work orders are the unit of work: you assign a supplier, schedule them, log costs, and those costs flow through to property profitability.

## Creating a work order

A work order **does not need a tenant ticket**. There are two ways to create one:

1. **Standalone (no ticket).** Go to **Maintenance → Work Orders** and click **New Work Order** in the top right. The button is also on the Tickets tab, and on mobile under the centre **＋** quick-action ("New work order"). Pick the property, give it a title, set category and priority, and optionally assign a supplier and a scheduled date. Use this for planned works, landlord-instructed jobs, inspections, and anything staff spot themselves.
2. **From a tenant ticket.** Open the ticket in the **Tickets** tab and click **Convert to Work Order** in the "Work order" section. This pre-fills the property, unit, description, priority, and reporter from the ticket, and links the two so status changes on the work order are mirrored back to the ticket and emailed to the tenant.

## Key tasks

1. **Review work orders and tickets.** The **Work Orders** tab has list and Kanban views with status, priority, and search filters; the **Tickets** tab shows what tenants have reported.
2. **Open a ticket.** Use the ticket drawer to read the detail and convert it to a work order when it needs work scheduled.
3. **Manage a work order.** In its drawer, update the status, record costs, upload photos, and set a reminder.
4. **Track costs.** Costs you log against a work order feed into the property's numbers. Untick "Charge to the landlord" for tenant-fault damage or work your agency absorbs.
5. **Manage suppliers.** In the **Suppliers** tab, keep a directory of your trusted contractors (plumbers, electricians, cleaners, gas engineers, …) with their trade, contact details, and notes.
6. **Assign a supplier.** Pick a supplier when creating the work order, or change the assignment any time from the drawer's Overview tab. The Suppliers tab shows how many active work orders each supplier currently has.
7. **Comment on tickets.** In the ticket drawer, post comments to keep the tenant informed — ticket comments are **visible to the tenant** in their tenant portal and on the support page, and each comment also **emails the tenant** automatically.
8. **Add work order notes.** The **Notes** tab holds internal staff notes (call outcomes, quotes, decisions). These are **never shown to tenants**.

## Tips

- Tickets are created by tenants through the maintenance chat assistant; **emergencies** (gas, fire, flood, etc.) automatically raise a priority ticket and prompt the tenant to call.
- Work order costs appear in [Profitability](/profitability) for the relevant property.
- A standalone work order isn't linked to a tenant, so no tenant emails are sent when its status changes — only ticket-linked work orders notify the tenant.
- Suppliers are searchable from the global search bar; deleting a supplier unassigns them from work orders but keeps the name on old ones for history.`,
};

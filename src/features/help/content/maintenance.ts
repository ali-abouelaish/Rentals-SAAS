import type { HelpArticle } from "../domain/types";

export const maintenanceArticle: HelpArticle = {
  slug: "maintenance",
  title: "Maintenance",
  route: "/maintenance",
  match: "prefix",
  summary:
    "Triage tenant tickets, track maintenance jobs and their costs, and manage your preferred supplier directory.",
  content: `## What this page is for

Maintenance brings together **tickets** raised by tenants, the **jobs** you run to resolve them, and your **preferred suppliers** directory. You triage incoming tickets, promote them into jobs, assign a supplier, and log costs that flow through to property profitability.

## Key tasks

1. **Review tickets and jobs.** The page shows both incoming tickets and active jobs; filter by property to focus.
2. **Open a ticket.** Use the ticket drawer to read the detail and **promote it to a job** when it needs work scheduled.
3. **Manage a job.** In the job drawer, update its status, record costs, and capture vendor/details.
4. **Track costs.** Costs you log against jobs feed into the property's numbers.
5. **Manage suppliers.** In the **Suppliers** tab, keep a directory of your trusted contractors (plumbers, electricians, cleaners, …) with their trade, contact details, and notes.
6. **Assign a supplier.** Pick a supplier when raising a new job, or change the assignment any time from the job drawer's Overview tab. The Suppliers tab shows how many active jobs each supplier currently has.
7. **Comment on tickets.** In the ticket drawer, post comments to keep the tenant informed — ticket comments are **visible to the tenant** in their tenant portal and on the support page, and each comment also **emails the tenant** automatically.
8. **Add job notes.** The job drawer's **Notes** tab holds internal staff notes (call outcomes, quotes, decisions). Job notes are **never shown to tenants**.

## Tips

- Tickets are created by tenants through the maintenance chat assistant; **emergencies** (gas, fire, flood, etc.) automatically raise a priority ticket and prompt the tenant to call.
- Job costs appear in [Profitability](/profitability) for the relevant property.
- Use the property filter to see all maintenance activity for one building at once.
- Suppliers are searchable from the global search bar; deleting a supplier unassigns them from jobs but keeps the name on old jobs for history.`,
};

import type { HelpArticle } from "../domain/types";

export const maintenanceArticle: HelpArticle = {
  slug: "maintenance",
  title: "Maintenance",
  route: "/maintenance",
  match: "prefix",
  summary: "Triage tenant tickets and track maintenance jobs and their costs.",
  content: `## What this page is for

Maintenance brings together **tickets** raised by tenants and the **jobs** you run to resolve them. You triage incoming tickets, promote them into jobs, and log costs that flow through to property profitability.

## Key tasks

1. **Review tickets and jobs.** The page shows both incoming tickets and active jobs; filter by property to focus.
2. **Open a ticket.** Use the ticket drawer to read the detail and **promote it to a job** when it needs work scheduled.
3. **Manage a job.** In the job drawer, update its status, record costs, and capture vendor/details.
4. **Track costs.** Costs you log against jobs feed into the property's numbers.

## Tips

- Tickets are created by tenants through the maintenance chat assistant; **emergencies** (gas, fire, flood, etc.) automatically raise a priority ticket and prompt the tenant to call.
- Job costs appear in [Profitability](/profitability) for the relevant property.
- Use the property filter to see all maintenance activity for one building at once.`,
};

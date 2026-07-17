export type SupportProperty = {
  id: string;
  name: string;
  address: string;
  units: SupportUnit[];
};

export type SupportUnit = {
  id: string;
  label: string;
  hasActiveTenancy: boolean;
};

export type SupportPmTenant = {
  id: string;
  firstName: string;
  fullName: string;
};

/** Pre-resolved identity for renters arriving from the tenant portal —
 *  skips the property/unit/name self-selection steps. */
export type SupportPrefill = {
  property: SupportProperty;
  unitId: string;
  tenant: SupportPmTenant;
};

/** A staff comment on a ticket, surfaced to the renter as an update. */
export type SupportTicketUpdate = {
  body: string;
  authorName: string;
  createdAt: string;
};

export type SupportActiveTicket = {
  reference: string;
  descriptionPreview: string;
  priority: "critical" | "high" | "medium" | "low";
  status:
    | "open"
    | "acknowledged"
    | "in_progress"
    | "pending_parts"
    | "pending_quote"
    | "resolved"
    | "closed"
    | "cancelled";
  createdAt: string;
  updates: SupportTicketUpdate[];
};

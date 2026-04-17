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
};

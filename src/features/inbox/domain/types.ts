export type InboxRequestType = "email_change" | "alternative_format" | "data_access" | "other";
export type InboxRequestStatus = "pending" | "approved" | "rejected" | "completed";

export const REQUEST_TYPE_LABELS: Record<InboxRequestType, string> = {
  email_change: "Email change",
  alternative_format: "Alternative format",
  data_access: "Data access (GDPR)",
  other: "Other request",
};

export const STATUS_LABELS: Record<InboxRequestStatus, string> = {
  pending:   "Pending",
  approved:  "Approved",
  completed: "Completed",
  rejected:  "Declined",
};

export const STATUS_BADGE: Record<InboxRequestStatus, string> = {
  pending:   "bg-amber-100 text-amber-800",
  approved:  "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  rejected:  "bg-slate-200 text-slate-700",
};

export type InboxRequest = {
  id: string;
  tenant_id: string;
  pm_tenant_id: string;
  request_type: InboxRequestType;
  status: InboxRequestStatus;
  payload: Record<string, unknown>;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  pm_tenant: {
    id: string;
    full_name: string;
    email: string;
  } | null;
};

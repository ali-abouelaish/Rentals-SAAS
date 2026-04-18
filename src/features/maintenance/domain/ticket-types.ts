export type TicketStatus =
  | "open"
  | "acknowledged"
  | "in_progress"
  | "pending_parts"
  | "pending_quote"
  | "resolved"
  | "closed"
  | "cancelled";

export type TicketPriority = "low" | "medium" | "high" | "critical";

export type MaintenanceTicketListItem = {
  id: string;
  reference: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  seen_by_landlord: boolean;
  created_at: string;
  resolved_at: string | null;
  property_id: string;
  unit_id: string;
  property_name: string;
  unit_label: string;
  pm_tenant_name: string;
  pm_tenant_email: string | null;
  pm_tenant_phone: string | null;
  emergency_type: string | null;
  attachment_count: number;
  conversation_id: string | null;
  job_id: string | null;
};

export type MaintenanceTicketAttachment = {
  id: string;
  kind: "image" | "video" | "audio";
  signed_url: string | null;
  storage_path: string;
};

export type MaintenanceTicketMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type MaintenanceTicketDetail = MaintenanceTicketListItem & {
  attachments: MaintenanceTicketAttachment[];
  messages: MaintenanceTicketMessage[];
};

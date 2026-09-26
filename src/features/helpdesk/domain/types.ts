import { z } from "zod";

// ──────────────────────────────────────────────────────────
// Enums + labels
// ──────────────────────────────────────────────────────────

export const TICKET_CATEGORIES = [
  "bug",
  "billing",
  "feature_request",
  "how_to",
  "data_issue",
  "other",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  bug: "Something isn't working",
  billing: "Billing & account",
  feature_request: "Feature request",
  how_to: "How do I…?",
  data_issue: "Wrong or missing data",
  other: "Something else",
};

export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low — whenever you can",
  normal: "Normal",
  high: "High — blocking part of my work",
  urgent: "Urgent — we can't operate",
};

export const PRIORITY_SHORT: Record<TicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_TONE: Record<TicketPriority, string> = {
  low: "bg-slate-100 text-slate-600 ring-slate-200",
  normal: "bg-sky-100 text-sky-700 ring-sky-200",
  high: "bg-amber-100 text-amber-700 ring-amber-200",
  urgent: "bg-red-100 text-red-700 ring-red-200",
};

export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "waiting_on_agency",
  "resolved",
  "closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_agency: "Waiting on you",
  resolved: "Resolved",
  closed: "Closed",
};

/** Platform-side wording — "Waiting on you" is only right from the agency's seat. */
export const STATUS_LABELS_PLATFORM: Record<TicketStatus, string> = {
  ...STATUS_LABELS,
  waiting_on_agency: "Waiting on agency",
};

export const STATUS_TONE: Record<TicketStatus, string> = {
  open: "bg-sky-100 text-sky-700 ring-sky-200",
  in_progress: "bg-blue-100 text-blue-700 ring-blue-200",
  waiting_on_agency: "bg-amber-100 text-amber-700 ring-amber-200",
  resolved: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  closed: "bg-slate-200 text-slate-700 ring-slate-300",
};

// ──────────────────────────────────────────────────────────
// Attachments
// ──────────────────────────────────────────────────────────

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB each
export const ALLOWED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
] as const;
export const ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_TYPES.join(",");

/** Returns an error message, or null when the file is acceptable. */
export function validateAttachment(file: { name: string; type: string; size: number }): string | null {
  if (!(ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
    return `${file.name}: only images, PDF, TXT or CSV files`;
  }
  if (file.size > MAX_ATTACHMENT_BYTES) return `${file.name}: max 10 MB per file`;
  if (file.size === 0) return `${file.name}: file is empty`;
  return null;
}

// ──────────────────────────────────────────────────────────
// Schemas — shared by the client forms and the server actions
// ──────────────────────────────────────────────────────────

export const createTicketSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(5, "Subject must be at least 5 characters")
    .max(150, "Max 150 characters"),
  category: z.enum(TICKET_CATEGORIES, { errorMap: () => ({ message: "Choose a category" }) }),
  priority: z.enum(TICKET_PRIORITIES, { errorMap: () => ({ message: "Choose a priority" }) }),
  body: z
    .string()
    .trim()
    .min(20, "Please describe the problem in at least 20 characters")
    .max(5000, "Max 5000 characters"),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

/** Silent context captured by the browser — never shown as form fields. */
export const ticketContextSchema = z.object({
  page_url: z.string().trim().max(2000).optional().nullable(),
  user_agent: z.string().trim().max(1000).optional().nullable(),
});

export const ticketMessageSchema = z.object({
  body: z.string().trim().min(1, "Message can't be empty").max(5000, "Max 5000 characters"),
});

export const ticketStatusSchema = z.enum(TICKET_STATUSES);

// ──────────────────────────────────────────────────────────
// Row shapes
// ──────────────────────────────────────────────────────────

export interface SupportTicketListItem {
  id: string;
  reference: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  last_message_at: string;
  /** Agency side: platform replied since the user last opened it.
   *  Platform side: agency wrote since a super admin last opened it. */
  unread: boolean;
}

export interface AdminSupportTicketListItem extends SupportTicketListItem {
  tenant_id: string;
  tenant_name: string;
  created_by_name: string;
}

export interface SupportMessage {
  id: string;
  author_name: string;
  author_side: "agency" | "platform";
  is_internal: boolean;
  body: string;
  created_at: string;
}

export interface SupportAttachment {
  id: string;
  message_id: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  signed_url: string | null;
}

export interface SupportTicketDetail {
  id: string;
  tenant_id: string;
  reference: string;
  subject: string;
  body: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  last_message_at: string;
  resolved_at: string | null;
  messages: SupportMessage[];
  attachments: SupportAttachment[];
}

export interface AdminSupportTicketDetail extends SupportTicketDetail {
  tenant_name: string;
  page_url: string | null;
  user_agent: string | null;
  app_version: string | null;
}

export type ActionResult =
  | { ok: true; id?: string; warning?: string }
  | { ok: false; error: string };

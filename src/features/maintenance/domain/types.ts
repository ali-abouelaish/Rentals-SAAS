export type JobStatus =
  | "open"
  | "in_progress"
  | "pending_parts"
  | "pending_quote"
  | "resolved"
  | "closed";

export type JobPriority = "low" | "medium" | "high" | "critical";

export type JobCategory =
  | "plumbing"
  | "electrical"
  | "structural"
  | "appliance"
  | "pest_control"
  | "cleaning"
  | "decoration"
  | "other";

export type MaintenanceJob = {
  id: string;
  tenant_id: string;
  property_id: string;
  unit_id: string | null;
  title: string;
  description: string | null;
  category: JobCategory;
  priority: JobPriority;
  status: JobStatus;
  reported_by: string | null;
  assigned_to: string | null;
  scheduled_date: string | null;
  resolved_date: string | null;
  total_cost: number; // pence
  created_at: string;
  updated_at: string;
  // joined fields
  property_name?: string;
  unit_label?: string | null;
  costs?: MaintenanceCost[];
  photos?: MaintenancePhoto[];
};

export type MaintenanceCost = {
  id: string;
  tenant_id: string;
  job_id: string;
  property_cost_id: string | null; // linked property_costs.id for profitability sync
  description: string;
  amount: number; // pence
  date_incurred: string;
  supplier: string | null;
  invoice_ref: string | null;
  created_at: string;
};

export type MaintenancePhoto = {
  id: string;
  tenant_id: string;
  job_id: string;
  url: string;
  caption: string | null;
  uploaded_at: string;
};

export type MaintenanceSummary = {
  open_jobs: number;
  in_progress_jobs: number;
  critical_jobs: number;
  resolved_this_month: number;
  total_cost_this_month: number; // pence
};

// ─── Display helpers ─────────────────────────────────────────────────────────

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  pending_parts: "Pending Parts",
  pending_quote: "Pending Quote",
  resolved: "Resolved",
  closed: "Closed",
};

export const JOB_PRIORITY_LABELS: Record<JobPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const JOB_CATEGORY_LABELS: Record<JobCategory, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  structural: "Structural",
  appliance: "Appliance",
  pest_control: "Pest Control",
  cleaning: "Cleaning",
  decoration: "Decoration",
  other: "Other",
};

export const JOB_PRIORITY_COLORS: Record<
  JobPriority,
  { bg: string; text: string; border: string; dot: string }
> = {
  low:      { bg: "bg-slate-50",   text: "text-slate-600",  border: "border-slate-200",  dot: "bg-slate-400" },
  medium:   { bg: "bg-blue-50",    text: "text-blue-600",   border: "border-blue-200",   dot: "bg-blue-500" },
  high:     { bg: "bg-orange-50",  text: "text-orange-600", border: "border-orange-200", dot: "bg-orange-500" },
  critical: { bg: "bg-red-50",     text: "text-red-600",    border: "border-red-200",    dot: "bg-red-500" },
};

export const JOB_STATUS_COLORS: Record<JobStatus, { bg: string; text: string }> = {
  open:          { bg: "bg-slate-100",   text: "text-slate-700" },
  in_progress:   { bg: "bg-blue-100",    text: "text-blue-700" },
  pending_parts: { bg: "bg-amber-100",   text: "text-amber-700" },
  pending_quote: { bg: "bg-violet-100",  text: "text-violet-700" },
  resolved:      { bg: "bg-emerald-100", text: "text-emerald-700" },
  closed:        { bg: "bg-gray-100",    text: "text-gray-500" },
};

/** Columns shown in the kanban view (excludes 'closed' to keep the board tidy) */
export const KANBAN_COLUMNS: JobStatus[] = [
  "open",
  "in_progress",
  "pending_parts",
  "pending_quote",
  "resolved",
];

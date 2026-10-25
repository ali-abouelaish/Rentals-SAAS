import type { PlanInterest, PortfolioSize } from "./schemas";

export const DEMO_REQUEST_STATUSES = ["new", "contacted", "booked", "closed", "spam"] as const;
export type DemoRequestStatus = (typeof DEMO_REQUEST_STATUSES)[number];

export const STATUS_LABELS: Record<DemoRequestStatus, string> = {
  new: "New",
  contacted: "Contacted",
  booked: "Demo booked",
  closed: "Closed",
  spam: "Spam",
};

/** What each status means, for the status control's hint. */
export const STATUS_HINTS: Record<DemoRequestStatus, string> = {
  new: "Nobody has replied yet. The website promises a reply within 48 hours.",
  contacted: "You've replied and are waiting to hear back.",
  booked: "A walkthrough is in the diary.",
  closed: "Finished: they signed up, or decided not to.",
  spam: "Not a real enquiry.",
};

export const STATUS_TONE: Record<DemoRequestStatus, string> = {
  new: "bg-amber-50 text-amber-800 ring-amber-200",
  contacted: "bg-sky-50 text-sky-800 ring-sky-200",
  booked: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  closed: "bg-slate-50 text-slate-700 ring-slate-200",
  spam: "bg-rose-50 text-rose-700 ring-rose-200",
};

export type DemoRequest = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  portfolio_size: PortfolioSize;
  goal: string | null;
  plan_interest: PlanInterest | null;
  status: DemoRequestStatus;
  admin_notes: string | null;
  team_notified_at: string | null;
  confirmation_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

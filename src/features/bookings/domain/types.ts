export type BookingStatus = "pending" | "under_review" | "approved" | "rejected";

export type Booking = {
  id: string;
  tenant_id: string;
  booking_reference: string | null;
  unit_id: string | null;
  property_id: string | null;
  portfolio_id: string | null;
  form_id: string | null;
  status: BookingStatus;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  converted_pm_tenant_id: string | null;
  notes: string | null;
  created_at: string;
  // agent-originated bookings (sent from a public property-share link)
  offer_price_pcm: number | null;
  agent_name: string | null;
  agent_email: string | null;
  source: "direct" | "share" | null;
  share_id: string | null;
  // joined
  unit?: {
    room_number: string | null;
    unit_type: string;
    property: {
      name: string;
      address_line_1: string;
      portfolio?: { id: string; name: string; color: string } | null;
    };
  } | null;
  form?: { name: string } | null;
  form_responses?: FormResponse[];
};

export type FormResponse = {
  id: string;
  booking_id: string;
  question_id: string;
  answer_text: string | null;
  answer_file_url: string | null;
  created_at: string;
  question?: {
    question_text: string;
    question_type: string;
  };
};

export type BookingFilters = {
  search: string;
  portfolioId: string;
  status: BookingStatus | "";
  dateFrom: string;
  dateTo: string;
};

export const BOOKING_STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; bg: string; fg: string; dot: string }
> = {
  pending:      { label: "Pending",      bg: "bg-gray-100",   fg: "text-gray-600",   dot: "bg-gray-400"   },
  under_review: { label: "Under Review", bg: "bg-blue-100",   fg: "text-blue-700",   dot: "bg-blue-500"   },
  approved:     { label: "Approved",     bg: "bg-green-100",  fg: "text-green-700",  dot: "bg-green-500"  },
  rejected:     { label: "Rejected",     bg: "bg-red-100",    fg: "text-red-700",    dot: "bg-red-500"    },
};

export const BOOKING_COLUMNS: BookingStatus[] = ["pending", "under_review", "approved", "rejected"];

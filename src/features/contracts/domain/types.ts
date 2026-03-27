export type ContractStatus =
  | "draft"
  | "sent"
  | "signed"
  | "active"
  | "notice_given"
  | "terminated";

export type DepositScheme = "dps" | "mydeposits" | "tds" | "none";
export type SigningMethod = "email" | "whatsapp" | "adobe_sign" | "docusign" | "paper" | "other";
export type NoticeGivenBy = "tenant" | "landlord";

export type PropertyContract = {
  id: string;
  tenant_id: string;
  unit_id: string;
  pm_tenant_id: string;
  start_date: string;
  rent_pcm: number;
  deposit: number;
  collection_date: number | null;
  deposit_scheme: DepositScheme;
  deposit_scheme_ref: string | null;
  deposit_protected_date: string | null;
  deposit_protection_deadline: string | null;
  deposit_protection_alert: boolean;
  signing_method: SigningMethod | null;
  status: ContractStatus;
  notice_given_by: NoticeGivenBy | null;
  notice_given_date: string | null;
  vacate_date: string | null;
  document_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  pm_tenant?: { full_name: string; email: string; phone: string } | null;
  unit?: {
    room_number: string | null;
    unit_type: string;
    property: {
      name: string;
      address_line_1: string;
      portfolio?: { name: string; color: string } | null;
    };
  } | null;
};

export type ContractFilters = {
  search: string;
  portfolioId: string;
  status: ContractStatus | "";
  depositProtected: "yes" | "no" | "";
};

export const CONTRACT_STATUS_CONFIG: Record<ContractStatus, { label: string; bg: string; fg: string }> = {
  draft:        { label: "Draft",        bg: "bg-gray-100",   fg: "text-gray-600"   },
  sent:         { label: "Sent",         bg: "bg-blue-100",   fg: "text-blue-700"   },
  signed:       { label: "Signed",       bg: "bg-cyan-100",   fg: "text-cyan-700"   },
  active:       { label: "Active",       bg: "bg-green-100",  fg: "text-green-700"  },
  notice_given: { label: "Notice Given", bg: "bg-amber-100",  fg: "text-amber-700"  },
  terminated:   { label: "Terminated",   bg: "bg-red-100",    fg: "text-red-700"    },
};

export const DEPOSIT_SCHEME_LABELS: Record<DepositScheme, string> = {
  dps: "Deposit Protection Service (DPS)",
  mydeposits: "MyDeposits",
  tds: "Tenancy Deposit Scheme (TDS)",
  none: "None / Not protected",
};

export const SIGNING_METHOD_LABELS: Record<SigningMethod, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  adobe_sign: "Adobe Sign",
  docusign: "DocuSign",
  paper: "Paper",
  other: "Other",
};

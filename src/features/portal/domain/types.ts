// Renter-facing portal domain types. "Tenant" here means the SaaS agency
// (tenants table); the renter is a pm_tenants row.

export const ACTIVE_CONTRACT_STATUSES = ["active", "signed", "notice_given"] as const;

export type PortalPmTenant = {
  id: string;
  fullName: string;
  firstName: string;
  email: string;
};

export type PortalTenancy = {
  contractId: string;
  status: string;
  /** True when this is a terminated contract shown for post-tenancy context
   *  (deposit return) because the renter has no active contract. */
  ended: boolean;
  startDate: string;
  expiryDate: string | null;
  rentPcm: number;
  collectionDate: number | null;
  paymentReference: string;
  propertyName: string;
  propertyAddress: string;
  unitLabel: string;
};

export type PortalPayment = {
  periodYear: number;
  periodMonth: number;
  amount: number;
  paidAt: string;
};

export type PortalRentStatus = {
  expected: number;
  paid: number;
  arrears: number;
  currentMonthPaid: boolean;
  /** ISO date of the next rent due day (this month if unpaid, else next). */
  nextDueDate: string;
  payments: PortalPayment[];
};

/** A staff comment on a ticket, surfaced to the renter as an update. */
export type PortalTicketUpdate = {
  body: string;
  authorName: string;
  createdAt: string;
};

export type PortalTicket = {
  reference: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  updates: PortalTicketUpdate[];
};

export type PortalDepositState = "protected" | "pending" | "none";

export type PortalDeposit = {
  amount: number;
  scheme: "dps" | "mydeposits" | "tds" | "none";
  state: PortalDepositState;
  schemeRef: string | null;
  protectedDate: string | null;
  /** mydeposits certificate link, when protection has been issued. */
  certificateUrl: string | null;
  /** TDS Deposit Account Number, when registered. */
  dan: string | null;
  /** DPS deposit id, when registered. */
  dpsDepositId: string | null;
  returned: boolean;
  returnedAt: string | null;
};

export type PortalAgencyContact = {
  name: string;
  email: string;
  phone: string | null;
};

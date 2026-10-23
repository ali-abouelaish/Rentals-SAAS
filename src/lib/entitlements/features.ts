export type FeatureKey =
  | "dashboard"
  | "my_profile"
  | "agents"
  | "clients"
  | "rentals"
  | "landlords"
  | "bonuses"
  | "earnings"
  | "manager_commission"
  | "invoices"
  | "room_enhancer"
  | "billing_profiles"
  | "billing_info"
  | "leads"
  | "website_leads"
  | "digital_business_card"
  | "properties"
  | "bookings"
  | "pm_tenants"
  | "contracts"
  | "contract_templates"
  | "profitability"
  | "maintenance"
  | "acquisition_insights"
  | "property_shares"
  | "keys"
  | "rent_collection"
  | "finances"
  | "ai_assistant"
  | "help_center"
  | "public_api_access"
  | "mydeposits"
  | "tds"
  | "dps"
  | "forms"
  | "tenant_portal"
  | "automations"
  | "certificates"
  | "owner_statements"
  | "e_signing"
  | "listing_feeds"
  | "support_tickets"
  | "email_sending"
  | "admin";

export const ALL_FEATURES: FeatureKey[] = [
  "dashboard",
  "my_profile",
  "agents",
  "clients",
  "rentals",
  "landlords",
  "bonuses",
  "earnings",
  "manager_commission",
  "invoices",
  "room_enhancer",
  "billing_profiles",
  "billing_info",
  "leads",
  "website_leads",
  "digital_business_card",
  "properties",
  "bookings",
  "pm_tenants",
  "contracts",
  "contract_templates",
  "profitability",
  "maintenance",
  "acquisition_insights",
  "property_shares",
  "keys",
  "rent_collection",
  "finances",
  "ai_assistant",
  "help_center",
  "public_api_access",
  "mydeposits",
  "tds",
  "dps",
  "forms",
  "tenant_portal",
  "automations",
  "certificates",
  "owner_statements",
  "e_signing",
  "listing_feeds",
  "support_tickets",
  "email_sending",
  "admin",
];

/**
 * Features that are OFF unless the agency has subscribed to the integration
 * that grants them.
 *
 * Every other feature key is on by default and only a `tenant_feature_entitlements`
 * row can take it away. That default is right for features that ship with the
 * product, and wrong for a paid integration — a new paid feature would
 * otherwise arrive switched on for every agency on the platform, and be billed
 * to nobody.
 *
 * These keys invert that: no active subscription (see
 * `tenant_integration_subscriptions`) means no access. A super admin can still
 * grant one by hand from the features manager, which is how a trial or a
 * goodwill extension is done without a subscription row.
 *
 * Keep in step with `featureKeys` in `src/lib/integrations/catalog.ts` — a key
 * listed here with no integration granting it is unreachable.
 */
export const PAID_FEATURES: ReadonlySet<FeatureKey> = new Set<FeatureKey>([
  "e_signing",
  "mydeposits",
  "tds",
  "dps",
]);

export function isPaidFeature(key: FeatureKey): boolean {
  return PAID_FEATURES.has(key);
}

export const FEATURE_META: Record<FeatureKey, { label: string; description: string }> = {
  dashboard: { label: "Dashboard", description: "Main dashboard and overview widgets." },
  my_profile: { label: "My Profile", description: "Personal profile and account settings page." },
  agents: { label: "Agents", description: "Agent directory, profiles, and commission controls." },
  clients: { label: "Clients", description: "Client CRM, lead capture, and status tracking." },
  rentals: { label: "Rentals", description: "Rental codes, approvals, and lifecycle updates." },
  landlords: { label: "Landlords", description: "Landlord records, profiles, and related listings." },
  bonuses: { label: "Bonuses", description: "Bonus submission, review, and payout workflows." },
  earnings: { label: "Earnings", description: "Earnings analytics, charts, and leaderboards." },
  manager_commission: {
    label: "Manager Commission",
    description:
      "Lets an agency make any agent or admin a manager who earns a percentage on the rentals and/or bonuses of a pool of agents. Paid from the company's share, never from the agent's commission; terms are dated so changes only affect deals from then on. Manager lines are marked paid individually in Earnings → Payments."
  },
  invoices: { label: "Invoices", description: "Invoice generation, approval, and payment tracking." },
  room_enhancer: {
    label: "Image Enhancer",
    description: "AI room/image enhancement and generation tools."
  },
  billing_profiles: {
    label: "Billing",
    description: "Invoice billing profiles and logo configuration."
  },
  billing_info: {
    label: "Billing Info",
    description: "Tenant billing account details and status."
  },
  leads: {
    label: "Leads",
    description:
      "Inbound leads from property portals (parsed from a connected Gmail inbox), the agency's own website and agent business cards."
  },
  website_leads: {
    label: "Website Lead Capture",
    description:
      "Lets the agency connect its own website under Leads → Settings, so enquiry-form submissions arrive as leads with source \"Website\" through a key that can only add leads. Requires Leads. Switching this off makes the endpoint refuse new enquiries (HTTP 403) and hides the settings card; connected keys are kept, so switching it back on resumes capture without the agency re-pasting anything."
  },
  digital_business_card: {
    label: "Digital Business Card",
    description: "Public agent profile card with QR code, vCard download, and enquiry link."
  },
  properties: {
    label: "Properties",
    description: "Property portfolio, room inventory, vacancy tracking, and marketing export."
  },
  bookings: {
    label: "Bookings",
    description: "Inbound rental applications pipeline with kanban workflow and approval cascade."
  },
  pm_tenants: {
    label: "Tenants",
    description: "Property tenant profiles, right to rent tracking, guarantors, and document storage."
  },
  contracts: {
    label: "Contracts",
    description: "Periodic tenancy contracts, deposit protection tracking, and notice management."
  },
  contract_templates: {
    label: "Contract Templates",
    description: "Upload tenancy contract PDFs, mark dynamic fields visually with AI assistance, and auto-stamp booking data into them."
  },
  profitability: {
    label: "Profitability",
    description: "Property P&L tracking, cost management, and profitability alerts."
  },
  maintenance: {
    label: "Maintenance",
    description: "Maintenance work order tracking, cost logging, and profitability integration."
  },
  acquisition_insights: {
    label: "Acquisition Insights",
    description: "AI-powered property evaluation tool with break-even calculator and portfolio-based recommendations."
  },
  property_shares: {
    label: "Property Shares",
    description: "Public token-gated share links for external partners to view a live, filtered unit inventory with images, commission, and tenant contact."
  },
  keys: {
    label: "Keys",
    description: "Physical key tracking — register every key for a property or unit, log check-out and check-in to internal agents or external contacts, and surface overdue returns across the portfolio."
  },
  rent_collection: {
    label: "Rent Collection",
    description: "Track rent payments, record collections, and view lifetime arrears across active tenancies."
  },
  finances: {
    label: "Finances",
    description: "Portfolio-wide monthly P&L hub rolling up rent collected, property costs, owner rent, vacancy loss and bank reconciliation, with admin overheads and monthly close coming in later phases."
  },
  ai_assistant: {
    label: "AI Assistant",
    description: "Admin-only read-only AI chat that answers questions about your properties, tenants, contracts, rent, finances, bookings and leads."
  },
  public_api_access: {
    label: "Public API",
    description: "Issue API keys so external platforms can read scraped listings (and future endpoints) over HTTPS."
  },
  mydeposits: {
    label: "Deposit Protection",
    description: "Protect tenancy deposits via MyDeposits (Total Property) — secure deposits, track protection certificates, and manage release requests."
  },
  tds: {
    label: "TDS Deposit Protection",
    description: "Protect tenancy deposits via the Tenancy Deposit Scheme (TDS Custodial) — register deposits, poll for the DAN, download DPC certificates, and raise repayment requests."
  },
  dps: {
    label: "DPS Deposit Protection",
    description: "Protect tenancy deposits via the Deposit Protection Service (DPS) — register tenancies, mark deposits for bank transfer with auto-allocation, and record protection."
  },
  help_center: {
    label: "Help Center",
    description: "In-app contextual help — shows a Help button on supported pages that opens an authored guide for the current screen in a side drawer."
  },
  forms: {
    label: "Forms",
    description: "Create and send fully customisable forms and view all responses.",
  },
  tenant_portal: {
    label: "Tenant Portal",
    description:
      "Renter-facing portal at /portal — passwordless magic-link sign-in with tenancy summary, rent status and standing-order payment reference, maintenance tickets, deposit protection, and agency contact details.",
  },
  automations: {
    label: "Automations & Reminders",
    description:
      "Scheduled messages engine — ad-hoc and recurring reminders with an inbox, automation rules (rent due, arrears, expiry dates, works-order chasing), editable message templates, and per-agency quiet hours with a daily send cap.",
  },
  certificates: {
    label: "Compliance Certificates",
    description:
      "Track statutory certificates (gas safety, EICR, EPC, fire alarm, HMO licences…) per property or room with document storage, a red/amber/green compliance dashboard, and expiry automations that chase the issuing contractor.",
  },
  owner_statements: {
    label: "Landlords & Statements",
    description:
      "The Landlords section for property owners — contact details, management fee, contract dates and the properties they own — plus their monthly statements: the rent owed on each property less the management fee, rechargeable works and other deductions, with opening/closing balances, an agency-branded PDF, and scheduled monthly draft generation.",
  },
  listing_feeds: {
    label: "Landlord Spreadsheets",
    description:
      "Import a landlord's room listings from their own Google Sheet — columns auto-mapped, re-read daily into the scraped listings feed. Note: the entitlement row for this has existed since 20260728000005 but the key was missing from this list, so it was silently discarded and the feature ran ungated for every agency.",
  },
  e_signing: {
    label: "E-signing",
    description:
      "Send tenancy agreements, works orders and owner statements for legally binding electronic signature via BoldSign, with the signed PDF and audit trail filed against the record. Paid integration — granted by an active subscription on the Integrations page, not on by default."
  },
  support_tickets: {
    label: "Contact Support",
    description:
      "Lets any agency user raise a support ticket with Harbor Ops, attach screenshots, and follow the reply thread. Tickets land in the super admin Support Tickets queue. Switching this off removes the agency's in-app route to us — leave it on."
  },
  email_sending: {
    label: "Email Sending",
    description:
      "Lets the agency connect its own mailbox (Microsoft 365, Gmail or SMTP) under Settings → Email Sending so tenant, landlord and invoice emails come from their address. Switching this off hides the page and ignores any mailbox already connected: every email still goes out, from the shared Harbor Ops mailer instead. The connection is kept, so switching it back on resumes sending from their mailbox (after a long time off they may be asked to reconnect it)."
  },
  admin: { label: "Admin", description: "Internal super admin functionality." }
};

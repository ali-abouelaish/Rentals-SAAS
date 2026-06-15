export type FeatureKey =
  | "dashboard"
  | "my_profile"
  | "agents"
  | "clients"
  | "rentals"
  | "landlords"
  | "bonuses"
  | "earnings"
  | "invoices"
  | "room_enhancer"
  | "billing_profiles"
  | "billing_info"
  | "leads"
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
  | "forms"
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
  "invoices",
  "room_enhancer",
  "billing_profiles",
  "billing_info",
  "leads",
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
  "forms",
  "admin",
];

export const FEATURE_META: Record<FeatureKey, { label: string; description: string }> = {
  dashboard: { label: "Dashboard", description: "Main dashboard and overview widgets." },
  my_profile: { label: "My Profile", description: "Personal profile and account settings page." },
  agents: { label: "Agents", description: "Agent directory, profiles, and commission controls." },
  clients: { label: "Clients", description: "Client CRM, lead capture, and status tracking." },
  rentals: { label: "Rentals", description: "Rental codes, approvals, and lifecycle updates." },
  landlords: { label: "Landlords", description: "Landlord records, profiles, and related listings." },
  bonuses: { label: "Bonuses", description: "Bonus submission, review, and payout workflows." },
  earnings: { label: "Earnings", description: "Earnings analytics, charts, and leaderboards." },
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
    description: "Inbound leads from property portals via Gmail parsing."
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
    description: "Maintenance job tracking, cost logging, and profitability integration."
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
  help_center: {
    label: "Help Center",
    description: "In-app contextual help — shows a Help button on supported pages that opens an authored guide for the current screen in a side drawer."
  },
  forms: {
    label: "Forms",
    description: "Create and send fully customisable forms and view all responses.",
  },
  admin: { label: "Admin", description: "Internal super admin functionality." }
};

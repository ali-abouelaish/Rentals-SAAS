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
  admin: { label: "Admin", description: "Internal super admin functionality." }
};

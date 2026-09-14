export type AdminOverviewStats = {
  tenantsCount: number;
  activeTenantsCount: number;
  suspendedTenantsCount: number;
  usersCount: number;
  activeUsersCount: number;
  profilesCount: number;
  activityCountLast7Days: number;
};

export type TenantListItem = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  contact_email: string | null;
};

export type TenantDetails = TenantListItem & {
  usersCount: number;
  activeUsersCount: number;
  profilesCount: number;
  brandingConfigured: boolean;
};

export type TenantUserListItem = {
  id: string;
  tenant_id: string;
  display_name: string | null;
  role: string;
  is_active: boolean;
  profile_id: string | null;
  created_at: string;
  email: string | null;
};

export type TenantBrandingSettings = {
  tenant_id: string;
  brand_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  theme_mode: "light" | "dark" | "system";
  font_family: string | null;
  updated_at: string;
};

export type TenantAccessProfile = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  permissions: Record<string, boolean>;
  is_system: boolean;
  created_at: string;
};

export type AdminActivityRow = {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  tenant_name: string | null;
  actor_name: string | null;
};

export type TenantFeatureEntitlement = {
  tenant_id: string;
  feature_key: string;
  is_enabled: boolean;
  ends_on: string | null;
  updated_at: string;
};

export type AgencyModuleConfig = {
  id: string;
  tenant_id: string;
  // Draft (what super admin is editing)
  rental_agency_enabled: boolean;
  property_management_enabled: boolean;
  // Live/published (what the agency sees)
  live_rental_agency_enabled: boolean;
  live_property_management_enabled: boolean;
  // Publishing state
  published: boolean;
  published_at: string | null;
  published_by: string | null;
  published_by_name?: string | null;
  last_updated_at: string;
  last_updated_by: string | null;
  last_updated_by_name?: string | null;
};

/** The live module access for a tenant — always derived from live_* fields. */
export type PublishedModuleConfig = {
  rental_agency_enabled: boolean;
  property_management_enabled: boolean;
};


/**
 * A tenant's subscription to a paid integration, as the super admin sees it.
 *
 * Mirrors `tenant_integration_subscriptions`. The price is the one frozen at
 * activation, not the current catalogue price — that is the number to invoice.
 */
export type AdminIntegrationSubscription = {
  integration_key: string;
  status: "active" | "pending_setup" | "cancelled";
  monthly_price_pence: number;
  is_grandfathered: boolean;
  activated_at: string | null;
  cancelled_at: string | null;
  billing_starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
};

/**
 * An envelope top-up purchase awaiting (or already on) an invoice.
 *
 * `price_pence` is the price frozen at the point of sale, not the current
 * catalogue price — it is the number to bill.
 */
export type AdminEnvelopePurchase = {
  id: string;
  pack_key: string;
  envelopes: number;
  price_pence: number;
  billing_period: string;
  purchased_at: string;
  invoiced_at: string | null;
};

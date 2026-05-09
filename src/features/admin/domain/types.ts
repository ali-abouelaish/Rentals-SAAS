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


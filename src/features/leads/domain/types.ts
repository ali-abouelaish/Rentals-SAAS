export type LeadStatus = "new" | "contacted" | "viewing" | "offer" | "closed";

export type Lead = {
  id: string;
  tenant_id: string;
  message_id: string;
  name: string;
  email: string;
  telephone: string | null;
  telephone_clean: string | null;
  address: string | null;
  full_address: string | null;
  property_ref: string | null;
  property_url: string | null;
  message_text: string | null;
  source: string;
  status: LeadStatus;
  listing_id: string | null;
  assigned_to: string | null;
  is_hot: boolean;
  has_phone: boolean;
  raw_body: string | null;
  /** The connected-website key that delivered this lead (website leads only). */
  api_key_id: string | null;
  clicked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadWithRelations = Lead & {
  assigned_agent: { id: string; display_name: string | null } | null;
  listing: { id: string; title: string | null; url: string | null } | null;
};

export type TenantGmailConnection = {
  tenant_id: string;
  gmail_address: string;
  token_expiry: string;
  history_id: string | null;
  last_synced_at: string | null;
  created_at: string;
};

/**
 * A connected website: a `leads:write` API key plus what it has delivered.
 * `lead_count` is null when the count couldn't be read (shown as "—").
 */
export type WebsiteConnection = {
  id: string;
  label: string;
  key_prefix: string;
  created_at: string;
  /** Last accepted request of any kind, test mode included. */
  last_used_at: string | null;
  revoked_at: string | null;
  lead_count: number | null;
  last_lead_at: string | null;
};

export type TenantPlatformConfig = {
  id: string;
  tenant_id: string;
  platform_name: string;
  sender_domain: string;
  is_active: boolean;
  created_at: string;
};

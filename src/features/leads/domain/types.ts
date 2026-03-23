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
  created_at: string;
  updated_at: string;
};

export type TenantGmailConnection = {
  tenant_id: string;
  gmail_address: string;
  token_expiry: string;
  history_id: string | null;
  last_synced_at: string | null;
  created_at: string;
};

export type TenantPlatformConfig = {
  id: string;
  tenant_id: string;
  platform_name: string;
  sender_domain: string;
  is_active: boolean;
  created_at: string;
};

export type Landlord = {
  id: string;
  tenant_id: string;
  name: string;
  contact: string | null;
  billing_address: string | null;
  email: string | null;
  spareroom_profile_url: string | null;
  pays_commission: boolean;
  we_do_viewing: boolean;
  created_at: string;
};

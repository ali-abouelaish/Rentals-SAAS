export type Landlord = {
  id: string;
  tenant_id: string;
  name: string;
  contact: string | null;
  billing_address: string | null;
  email: string | null;
  spareroom_profile_url: string | null;
  pays_commission: boolean;
  commission_amount_gbp: number;
  commission_term_text: string | null;
  we_do_viewing: boolean;
  profile_notes: string | null;
  created_at: string;
};

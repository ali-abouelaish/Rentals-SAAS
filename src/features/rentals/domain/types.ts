export type RentalCode = {
  id: string;
  tenant_id: string;
  code: string;
  date: string;
  consultation_fee_amount: number;
  payment_method: "cash" | "transfer" | "card";
  property_address: string;
  licensor_name: string;
  assisted_by_agent_id: string;
  marketing_agent_id: string | null;
  landlord_id: string | null;
  marketing_fee_override_gbp: number | null;
  marketing_fee_override_reason: string | null;
  status: "pending" | "approved" | "paid" | "refunded";
  client_snapshot: {
    full_name: string;
    phone: string;
    nationality?: string | null;
    dob?: string | null;
    company_or_university_name?: string | null;
    occupation?: string | null;
  };
  created_at: string;
};

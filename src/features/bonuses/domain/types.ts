export type Bonus = {
  id: string;
  tenant_id: string;
  landlord_id: string;
  amount_owed: number;
  agent_id: string;
  payout_mode: "standard" | "full";
  status: "pending" | "approved" | "rejected";
  invoice_pending: boolean;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
};

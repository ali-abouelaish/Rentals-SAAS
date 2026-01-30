export type Client = {
  id: string;
  tenant_id: string;
  full_name: string;
  dob: string | null;
  phone: string;
  email: string | null;
  nationality: string | null;
  current_address: string | null;
  company_name: string | null;
  company_address: string | null;
  occupation: string | null;
  status: "pending" | "on_hold" | "solved";
  assigned_agent_id: string | null;
  created_at: string;
};

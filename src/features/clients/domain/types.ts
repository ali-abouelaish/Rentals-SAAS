export type Client = {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  full_name: string; // generated column: first_name || ' ' || last_name
  dob: string;
  phone: string;
  email: string;
  nationality: string;
  current_address: string;
  company_or_university_name: string;
  company_address: string;
  occupation: string;
  status: "pending" | "on_hold" | "solved" | "registered";
  assigned_agent_id: string | null;
  created_at: string;
};

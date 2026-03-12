export type AgentProfile = {
  user_id: string;
  tenant_id: string;
  avatar_url: string | null;
  commission_percent: number;
  marketing_fee: number;
  role_flags: {
    is_agent: boolean;
    is_marketing: boolean;
  };
  is_disabled?: boolean;
};

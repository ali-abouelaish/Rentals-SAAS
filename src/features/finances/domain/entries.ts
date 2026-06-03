export type FinanceDirection = "income" | "expense";

export type FinanceSourceKind =
  | "rent_payment"
  | "property_cost"
  | "business_overhead"
  | "tenant_charge"
  | "owner_rent"
  | "bank_credit"
  | "manual";

export type FinanceEntry = {
  id: string;
  tenant_id: string;
  year: number;
  month: number;
  direction: FinanceDirection;
  amount: number; // pence
  source_kind: FinanceSourceKind;
  source_id: string | null;
  property_id: string | null;
  unit_id: string | null;
  contract_id: string | null;
  label: string;
  category: string | null;
  notes: string | null;
  posted_at: string;
  posted_by: string | null;
  close_id: string | null;
  created_at: string;
};

export type PostStatus = {
  posted: boolean;
  inserted_count: number;
  last_posted_at: string | null;
};

export type PostResult =
  | { success: true; inserted: number; skipped: number }
  | { error: string };

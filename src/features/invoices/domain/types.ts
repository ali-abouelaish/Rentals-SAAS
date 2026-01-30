export type BillingProfile = {
  id: string;
  tenant_id: string;
  name: string;
  sender_company_name: string;
  sender_address: string | null;
  sender_email: string | null;
  sender_phone: string | null;
  bank_account_holder_name: string;
  bank_account_number: string;
  bank_sort_code: string;
  logo_url: string | null;
  default_payment_terms_days: number;
  footer_thank_you_text: string;
  created_at: string;
  updated_at: string;
};

export type InvoiceItem = {
  id: string;
  tenant_id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  sort_order: number;
};

export type Invoice = {
  id: string;
  tenant_id: string;
  billing_profile_id: string;
  landlord_id: string;
  invoice_number: string;
  issue_date: string;
  payment_terms_days: number;
  due_date: string;
  status: string;
  created_by_user_id: string;
  approved_by_user_id: string | null;
  notes: string | null;
  subtotal: number;
  total: number;
  balance_due: number;
  pdf_storage_path: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  sent_at: string | null;
  paid_at: string | null;
  declined_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceBonusLink = {
  id: string;
  tenant_id: string;
  invoice_id: string;
  bonus_id: string;
};

export type InvoiceStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "sent"
  | "paid"
  | "declined"
  | "void";

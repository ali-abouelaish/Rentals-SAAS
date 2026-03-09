export type BillingPlan = "starter" | "professional" | "enterprise";
export type BillingPaymentStatus = "active" | "past_due" | "canceled" | "trialing" | "unpaid";

export type TenantBillingInfo = {
  id: string;
  tenant_id: string;
  plan: BillingPlan;
  billing_email: string | null;
  billing_name: string | null;
  billing_address: string | null;
  payment_status: BillingPaymentStatus;
  next_billing_date: string | null;
  stripe_customer_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

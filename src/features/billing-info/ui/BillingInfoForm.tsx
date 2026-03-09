"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { TenantBillingInfo } from "../domain/types";
import { upsertTenantBillingInfo } from "../actions/billingInfo";

const PLAN_OPTIONS = [
  { value: "starter", label: "Starter" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "trialing", label: "Trialing" },
  { value: "past_due", label: "Past due" },
  { value: "unpaid", label: "Unpaid" },
  { value: "canceled", label: "Canceled" },
];

type Props = { info: TenantBillingInfo | null };

export function BillingInfoForm({ info }: Props) {
  return (
    <Card key={info?.updated_at ?? info?.id ?? "new"}>
      <CardContent className="pt-6">
        <form action={upsertTenantBillingInfo} className="grid gap-4 md:grid-cols-2">
          <Select
            name="plan"
            label="Plan"
            options={PLAN_OPTIONS}
            defaultValue={info?.plan ?? "starter"}
          />
          <Select
            name="payment_status"
            label="Payment status"
            options={STATUS_OPTIONS}
            defaultValue={info?.payment_status ?? "active"}
          />
          <Input
            name="billing_email"
            type="email"
            placeholder="Billing email"
            defaultValue={info?.billing_email ?? ""}
          />
          <Input
            name="billing_name"
            placeholder="Billing name / company"
            defaultValue={info?.billing_name ?? ""}
          />
          <div className="md:col-span-2">
            <Input
              name="billing_address"
              placeholder="Billing address"
              defaultValue={info?.billing_address ?? ""}
            />
          </div>
          <Input
            name="next_billing_date"
            type="date"
            placeholder="Next billing date"
            defaultValue={info?.next_billing_date ?? ""}
          />
          <Input
            name="stripe_customer_id"
            placeholder="Stripe customer ID (optional)"
            defaultValue={info?.stripe_customer_id ?? ""}
          />
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-foreground-muted mb-1.5">
              Notes
            </label>
            <textarea
              name="notes"
              rows={2}
              className="flex w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-border-ring/20"
              placeholder="Internal notes"
              defaultValue={info?.notes ?? ""}
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Save billing info</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

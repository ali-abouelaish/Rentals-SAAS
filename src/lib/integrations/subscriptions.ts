import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FeatureKey } from "@/lib/entitlements/features";
import { getIntegration, type IntegrationKey } from "./catalog";
import {
  endOfCurrentMonth,
  featureKeysFromRows,
  firstOfNextMonth,
  subscriptionGrantsAccess,
  todayIso,
} from "./access";

// The access and billing-date rules live in ./access.ts, dependency-free so
// they can be unit-tested. Re-exported here so call sites have one import.
export { subscriptionGrantsAccess, firstOfNextMonth, endOfCurrentMonth };

export type SubscriptionStatus = "active" | "pending_setup" | "cancelled";

export type IntegrationSubscription = {
  integration_key: string;
  status: SubscriptionStatus;
  monthly_price_pence: number;
  is_grandfathered: boolean;
  activated_at: string | null;
  cancelled_at: string | null;
  billing_starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
};

const SELECT =
  "integration_key, status, monthly_price_pence, is_grandfathered, activated_at, cancelled_at, billing_starts_on, ends_on, notes";

/**
 * Feature keys granted by a set of subscription rows, resolved against the
 * catalogue.
 */
export function featuresFromSubscriptions(
  rows: Pick<IntegrationSubscription, "integration_key" | "status" | "ends_on">[],
  asOf: string = todayIso()
): FeatureKey[] {
  return featureKeysFromRows<FeatureKey>(
    rows,
    (key) => getIntegration(key)?.featureKeys ?? null,
    asOf
  );
}

/**
 * Every subscription row for the tenant, including cancelled ones — the
 * Integrations page shows "ends on 30 September" rather than pretending a
 * cancelled integration was never there.
 *
 * Read through the SSR client so RLS scopes it.
 */
export async function getTenantSubscriptions(
  tenantId: string
): Promise<IntegrationSubscription[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenant_integration_subscriptions")
    .select(SELECT)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
  return (data ?? []) as IntegrationSubscription[];
}

/**
 * Subscription rows keyed by integration, for rendering the page.
 */
export async function getSubscriptionMap(
  tenantId: string
): Promise<Map<IntegrationKey, IntegrationSubscription>> {
  const rows = await getTenantSubscriptions(tenantId);
  return new Map(
    rows
      .filter((row) => getIntegration(row.integration_key))
      .map((row) => [row.integration_key as IntegrationKey, row])
  );
}

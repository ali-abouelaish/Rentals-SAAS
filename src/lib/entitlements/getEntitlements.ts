import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import {
  featuresFromSubscriptions,
  type SubscriptionStatus,
} from "@/lib/integrations/subscriptions";
import { ALL_FEATURES, PAID_FEATURES, type FeatureKey } from "./features";

function isFeatureKey(value: string): value is FeatureKey {
  return (ALL_FEATURES as string[]).includes(value);
}

/**
 * Which features the current tenant may use.
 *
 * Resolved in three layers, in this order, because each one has to be able to
 * override the one before it:
 *
 *   1. BASE — every feature that ships with the product. On by default; the
 *      paid ones (`PAID_FEATURES`) are deliberately excluded, because arriving
 *      switched on for everyone is exactly wrong for something billable.
 *   2. SUBSCRIPTIONS — the paid features the agency has actually subscribed to
 *      on the Integrations page. This is the normal way a paid feature is
 *      granted.
 *   3. ENTITLEMENT ROWS — the super-admin override, applied last so it wins
 *      both ways: it can revoke a feature the tenant subscribes to (non-payment,
 *      abuse) and grant one they don't (a trial, a goodwill extension, an
 *      agency being onboarded before billing starts).
 *
 * Layer 3 winning over layer 2 is the point. A super admin who switches a paid
 * feature off in the features manager writes an explicit disabled row, and that
 * must not be quietly undone by the subscription that is still active.
 */
export async function getEntitlements(): Promise<Set<FeatureKey>> {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();

  const [entitlementResult, subscriptionResult] = await Promise.all([
    supabase
      .from("tenant_feature_entitlements")
      .select("feature_key, is_enabled, ends_on")
      .eq("tenant_id", profile.tenant_id),
    supabase
      .from("tenant_integration_subscriptions")
      .select("integration_key, status, ends_on")
      .eq("tenant_id", profile.tenant_id),
  ]);

  if (entitlementResult.error) {
    throw new Error(entitlementResult.error.message);
  }

  const today = new Date().toISOString().slice(0, 10);

  // Layer 1: everything that isn't admin-only and isn't paid.
  const enabled = new Set<FeatureKey>(
    ALL_FEATURES.filter((feature) => feature !== "admin" && !PAID_FEATURES.has(feature))
  );

  // Layer 2: paid features unlocked by an active subscription.
  //
  // A failure here is swallowed rather than thrown. The table is new and
  // applied by hand, so there is a window where the code is deployed and the
  // table is not; blowing up would take down every page in the app rather than
  // just the paid features. Degrading to "no paid features" is the safe
  // direction — it under-grants rather than over-grants.
  if (!subscriptionResult.error && subscriptionResult.data) {
    const rows = subscriptionResult.data as {
      integration_key: string;
      status: SubscriptionStatus;
      ends_on: string | null;
    }[];
    for (const key of featuresFromSubscriptions(rows, today)) {
      enabled.add(key);
    }
  }

  const data = entitlementResult.data;
  if (!data || data.length === 0) {
    return enabled;
  }

  // Layer 3: explicit per-tenant overrides.
  data.forEach((row) => {
    // Backward-compatibility for previously used "settings" feature key.
    if (row.feature_key === "settings") {
      const isAllowed = row.is_enabled && (!row.ends_on || row.ends_on >= today);
      if (!isAllowed) {
        enabled.delete("billing_profiles");
        enabled.delete("billing_info");
      } else {
        enabled.add("billing_profiles");
        enabled.add("billing_info");
      }
      return;
    }

    if (!isFeatureKey(row.feature_key)) return;
    if (!row.is_enabled || (row.ends_on && row.ends_on < today)) {
      enabled.delete(row.feature_key);
      return;
    }
    enabled.add(row.feature_key);
  });

  return enabled;
}

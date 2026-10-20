import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PAID_FEATURES, type FeatureKey } from "./features";

/**
 * Entitlement checks for code that has no signed-in user — the email outbox
 * worker, cron jobs, OAuth callbacks. `getEntitlements()` needs a session, so
 * these read by tenant id through the admin client instead.
 *
 * Default-on features only. For those, an explicit row is the only thing that
 * can switch the feature off, so no row means enabled. A paid feature also
 * depends on the agency's subscriptions, which these do not read — passing one
 * throws rather than quietly answering "off".
 */

type EntitlementRow = { is_enabled: boolean; ends_on: string | null };

function rowAllows(row: EntitlementRow, today: string): boolean {
  return row.is_enabled && (!row.ends_on || row.ends_on >= today);
}

function assertDefaultOn(key: FeatureKey) {
  if (PAID_FEATURES.has(key)) {
    throw new Error(`${key} is a paid feature; resolve it with getEntitlements().`);
  }
}

export async function isFeatureEnabledForTenant(
  tenantId: string,
  key: FeatureKey
): Promise<boolean> {
  assertDefaultOn(key);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("tenant_feature_entitlements")
    .select("is_enabled, ends_on")
    .eq("tenant_id", tenantId)
    .eq("feature_key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return true;
  return rowAllows(data as EntitlementRow, new Date().toISOString().slice(0, 10));
}

/** Every tenant that has `key` switched off (or expired), for batch jobs. */
export async function tenantsWithFeatureDisabled(key: FeatureKey): Promise<Set<string>> {
  assertDefaultOn(key);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("tenant_feature_entitlements")
    .select("tenant_id, is_enabled, ends_on")
    .eq("feature_key", key);
  if (error) throw new Error(error.message);
  const today = new Date().toISOString().slice(0, 10);
  return new Set(
    ((data ?? []) as Array<EntitlementRow & { tenant_id: string }>)
      .filter((row) => !rowAllows(row, today))
      .map((row) => row.tenant_id)
  );
}

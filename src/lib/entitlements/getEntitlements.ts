import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { ALL_FEATURES, type FeatureKey } from "./features";

function isFeatureKey(value: string): value is FeatureKey {
  return (ALL_FEATURES as string[]).includes(value);
}

export async function getEntitlements(): Promise<Set<FeatureKey>> {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("tenant_feature_entitlements")
    .select("feature_key, is_enabled, ends_on")
    .eq("tenant_id", profile.tenant_id);

  if (error) {
    throw new Error(error.message);
  }

  const today = new Date().toISOString().slice(0, 10);
  // Default all non-admin features to enabled, then apply DB overrides.
  const enabled = new Set<FeatureKey>(
    ALL_FEATURES.filter((feature) => feature !== "admin")
  );

  if (!data || data.length === 0) {
    return enabled;
  }

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

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PublicCardData } from "../domain/types";

export async function getPublicCardData(agentId: string): Promise<PublicCardData | null> {
  const supabase = createSupabaseAdminClient();

  const { data: agent } = await supabase
    .from("agent_profiles")
    .select("user_id, tenant_id, avatar_url, phone, contact_email, facebook_url, instagram_url, linkedin_url, user_profiles(display_name, role)")
    .eq("user_id", agentId)
    .single();

  if (!agent) return null;

  const [brandingResult, entitlementResult] = await Promise.all([
    supabase
      .from("tenant_branding_settings")
      .select("brand_name, logo_url, primary_color, secondary_color")
      .eq("tenant_id", agent.tenant_id)
      .single(),
    supabase
      .from("tenant_feature_entitlements")
      .select("is_enabled")
      .eq("tenant_id", agent.tenant_id)
      .eq("feature_key", "digital_business_card")
      .single(),
  ]);

  const entitlement = entitlementResult.data;
  if (entitlement && entitlement.is_enabled === false) return null;

  const up = agent.user_profiles as { display_name?: string | null; role?: string | null } | null;
  const branding = brandingResult.data;

  return {
    agentId: agent.user_id,
    displayName: up?.display_name ?? "Agent",
    role: up?.role ?? "agent",
    avatarUrl: agent.avatar_url ?? null,
    phone: agent.phone ?? null,
    contactEmail: agent.contact_email ?? null,
    facebookUrl: agent.facebook_url ?? null,
    instagramUrl: agent.instagram_url ?? null,
    linkedinUrl: agent.linkedin_url ?? null,
    tenantId: agent.tenant_id,
    branding: {
      brandName: branding?.brand_name ?? null,
      logoUrl: branding?.logo_url ?? null,
      primaryColor: branding?.primary_color ?? null,
      secondaryColor: branding?.secondary_color ?? null,
    },
  };
}

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type Agency, normalizeBranding } from "./branding";

/**
 * Load an agency (tenants row + normalized branding) by id.
 * Uses the admin client because cron + webhook callers have no session.
 */
export async function loadAgency(tenantId: string): Promise<Agency | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("tenants")
    .select("id, name, branding")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id as string,
    name: (data.name as string) ?? "",
    branding: normalizeBranding(data.branding),
  };
}

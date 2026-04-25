import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import type { PublicApiKey } from "../domain/types";

export async function listPublicApiKeys(): Promise<PublicApiKey[]> {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("public_api_keys")
    .select("id, tenant_id, label, key_prefix, scopes, created_at, last_used_at, revoked_at")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as PublicApiKey[];
}

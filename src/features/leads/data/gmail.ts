import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import type { TenantGmailConnection, TenantPlatformConfig } from "../domain/types";

export async function getGmailConnection(): Promise<TenantGmailConnection | null> {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();

  const { data } = await supabase
    .from("tenant_gmail_connections")
    .select("tenant_id, gmail_address, token_expiry, history_id, last_synced_at, created_at")
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  return data as TenantGmailConnection | null;
}

export async function getPlatformConfigs(): Promise<TenantPlatformConfig[]> {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();

  const { data, error } = await supabase
    .from("tenant_platform_configs")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as TenantPlatformConfig[];
}

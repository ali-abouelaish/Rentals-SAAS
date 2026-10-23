import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { LEADS_WRITE_SCOPE } from "@/lib/api-keys/scopes";
import type { WebsiteConnection } from "../domain/types";

/**
 * The tenant's connected websites — every key that can send leads, newest
 * first — with what each has delivered. Counts come from leads.api_key_id; if
 * that read fails (say, before the migration adding the column is applied)
 * the count shows "—" instead of breaking the settings page.
 */
export async function listWebsiteConnections(): Promise<WebsiteConnection[]> {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("public_api_keys")
    .select("id, label, key_prefix, created_at, last_used_at, revoked_at")
    .eq("tenant_id", profile.tenant_id)
    .contains("scopes", [LEADS_WRITE_SCOPE])
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return Promise.all(
    (data ?? []).map(async (key) => {
      const [counted, latest] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("api_key_id", key.id),
        supabase
          .from("leads")
          .select("created_at")
          .eq("api_key_id", key.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        id: key.id as string,
        label: key.label as string,
        key_prefix: key.key_prefix as string,
        created_at: key.created_at as string,
        last_used_at: (key.last_used_at as string | null) ?? null,
        revoked_at: (key.revoked_at as string | null) ?? null,
        lead_count: counted.error ? null : counted.count ?? 0,
        last_lead_at: latest.error ? null : ((latest.data?.created_at as string | undefined) ?? null),
      };
    })
  );
}

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type QuickLink = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  position: number;
  /** Website sign-in: the card opens /api/quick-links/<id>/launch instead of url. */
  sso_enabled: boolean;
  sso_callback_url: string | null;
};

export async function getQuickLinks(): Promise<QuickLink[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("tenant_quick_links")
    .select("id, title, url, description, position, sso_enabled, sso_callback_url")
    .order("position", { ascending: true });
  return data ?? [];
}

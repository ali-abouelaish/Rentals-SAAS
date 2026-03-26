import { createSupabaseServerClient } from "@/lib/supabase/server";

export type QuickLink = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  position: number;
};

export async function getQuickLinks(): Promise<QuickLink[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("tenant_quick_links")
    .select("id, title, url, description, position")
    .order("position", { ascending: true });
  return data ?? [];
}

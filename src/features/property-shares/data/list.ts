import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { PropertyShare } from "../domain/types";

export type ShareListRow = PropertyShare & {
  view_count: number;
  last_viewed_at: string | null;
};

export async function listShares(): Promise<ShareListRow[]> {
  await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: shares, error } = await supabase
    .from("property_shares")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!shares || shares.length === 0) return [];

  const ids = shares.map((s) => s.id);
  const { data: views, error: viewsError } = await supabase
    .from("share_views")
    .select("share_id, viewed_at")
    .in("share_id", ids);

  if (viewsError) throw new Error(viewsError.message);

  const counts = new Map<string, { count: number; last: string | null }>();
  (views ?? []).forEach((v) => {
    const row = counts.get(v.share_id) ?? { count: 0, last: null };
    row.count += 1;
    if (!row.last || v.viewed_at > row.last) row.last = v.viewed_at;
    counts.set(v.share_id, row);
  });

  return shares.map((share) => ({
    ...(share as PropertyShare),
    view_count: counts.get(share.id)?.count ?? 0,
    last_viewed_at: counts.get(share.id)?.last ?? null,
  }));
}

export async function getShareWithStats(shareId: string): Promise<ShareListRow | null> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: share, error } = await supabase
    .from("property_shares")
    .select("*")
    .eq("id", shareId)
    .single();

  if (error || !share) return null;
  if (share.tenant_id !== profile.tenant_id) return null;

  const { data: views } = await supabase
    .from("share_views")
    .select("viewed_at")
    .eq("share_id", shareId);

  const list = views ?? [];
  const last = list.length > 0
    ? list.reduce<string | null>((acc, v) => (!acc || v.viewed_at > acc ? v.viewed_at : acc), null)
    : null;

  return {
    ...(share as PropertyShare),
    view_count: list.length,
    last_viewed_at: last,
  };
}

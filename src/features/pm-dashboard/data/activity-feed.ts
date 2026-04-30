import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActivityFeedItem } from "../ui/PMDashboardPage";

type Row = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_user_id: string | null;
};

function pickSubject(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  for (const key of ["subject", "label", "name", "code", "title"]) {
    const v = metadata[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

export async function getDashboardActivityFeed(limit = 8): Promise<ActivityFeedItem[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, action, entity_type, entity_id, metadata, created_at, actor_user_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as Row[];

  // Fetch actor display names in a separate query (one per distinct user) to
  // keep the join robust against PostgREST FK-alias quirks.
  const actorIds = Array.from(
    new Set(rows.map((r) => r.actor_user_id).filter((x): x is string => !!x))
  );
  const actorNames = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .in("id", actorIds);
    for (const p of profiles ?? []) {
      if (p.display_name) actorNames.set(p.id as string, p.display_name as string);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    actor_name: (r.actor_user_id && actorNames.get(r.actor_user_id)) || "System",
    created_at: r.created_at,
    subject: pickSubject(r.metadata),
  }));
}

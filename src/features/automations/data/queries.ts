// Server-side reads for the reminders inbox and entity-scoped reminder lists.
// Uses the admin client with explicit tenant scoping (same posture as the
// action layer) — the caller passes the authenticated profile's tenant id.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MessageEntityType, ScheduledMessageRow } from "../domain/types";

export type ReminderTab = "pending" | "queued" | "sent" | "failed" | "dismissed";

export type InboxFilters = {
  tab: ReminderTab;
  assigneeId?: string;
  entityType?: MessageEntityType;
};

export type InboxMessage = ScheduledMessageRow & {
  assignee_name: string | null;
};

const PAGE_SIZE = 100;

export async function getRemindersInbox(
  tenantId: string,
  filters: InboxFilters
): Promise<InboxMessage[]> {
  const admin = createSupabaseAdminClient();

  let query = admin
    .from("scheduled_messages")
    .select("*")
    .eq("tenant_id", tenantId)
    .limit(PAGE_SIZE);

  switch (filters.tab) {
    case "pending":
      query = query
        .eq("channel", "in_app")
        .eq("status", "sent")
        .is("acknowledged_at", null)
        .order("send_at", { ascending: true });
      break;
    case "queued":
      query = query.in("status", ["queued", "snoozed"]).order("send_at", { ascending: true });
      break;
    case "sent":
      query = query.eq("status", "sent").order("sent_at", { ascending: false });
      break;
    case "failed":
      query = query.eq("status", "failed").order("updated_at", { ascending: false });
      break;
    case "dismissed":
      query = query
        .in("status", ["dismissed", "cancelled"])
        .order("updated_at", { ascending: false });
      break;
  }

  if (filters.assigneeId) query = query.eq("assignee_user_id", filters.assigneeId);
  if (filters.entityType) query = query.eq("related_entity_type", filters.entityType);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ScheduledMessageRow[];

  // Resolve assignee display names in one lookup.
  const assigneeIds = [...new Set(rows.map((r) => r.assignee_user_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (assigneeIds.length > 0) {
    const { data: users, error: usersErr } = await admin
      .from("user_profiles")
      .select("id, display_name")
      .in("id", assigneeIds);
    if (usersErr) throw new Error(usersErr.message);
    for (const u of users ?? []) {
      names.set(u.id as string, (u.display_name as string | null) || "Unnamed user");
    }
  }

  return rows.map((r) => ({
    ...r,
    assignee_name: r.assignee_user_id ? (names.get(r.assignee_user_id) ?? null) : null,
  }));
}

/**
 * Dashboard panel feed: actionable in-app reminders (pending) first, then the
 * soonest upcoming scheduled ones (queued/snoozed), capped at `limit`.
 */
export async function getUpcomingReminders(
  tenantId: string,
  limit = 6
): Promise<InboxMessage[]> {
  const [pending, queued] = await Promise.all([
    getRemindersInbox(tenantId, { tab: "pending" }),
    getRemindersInbox(tenantId, { tab: "queued" }),
  ]);
  return [...pending, ...queued].slice(0, limit);
}

/** Count of pending in-app reminders (for badges). */
export async function getPendingReminderCount(tenantId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("scheduled_messages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("channel", "in_app")
    .eq("status", "sent")
    .is("acknowledged_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Recent reminders linked to one entity, for detail-page embeds. */
export async function getEntityReminders(
  tenantId: string,
  entityType: MessageEntityType,
  entityId: string,
  limit = 10
): Promise<ScheduledMessageRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("scheduled_messages")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("related_entity_type", entityType)
    .eq("related_entity_id", entityId)
    .in("status", ["queued", "snoozed", "sent", "failed"])
    .order("send_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ScheduledMessageRow[];
}

import "server-only";

import { requireSuperAdmin } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ATTACHMENT_COLUMNS, signAttachments } from "./attachments";
import type {
  AdminSupportTicketDetail,
  AdminSupportTicketListItem,
  SupportMessage,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "../domain/types";

// Platform-side reads. Service role behind requireSuperAdmin() — re-checked
// here even though the /admin layout already gates, per the admin convention.

export type AdminTicketFilters = {
  status?: string; // a TicketStatus, "active" (default) or "all"
  priority?: string;
  tenantId?: string;
};

export type AdminTicketQueue = {
  tickets: AdminSupportTicketListItem[];
  agencies: { id: string; name: string }[];
  counts: { active: number; unread: number; urgent: number };
  /** True when the table is missing — migration not yet applied. */
  unavailable: boolean;
};

const ACTIVE_STATUSES: TicketStatus[] = ["open", "in_progress", "waiting_on_agency"];

export async function listAllTickets(filters: AdminTicketFilters = {}): Promise<AdminTicketQueue> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  let query = admin
    .from("platform_support_tickets")
    .select(
      "id, tenant_id, reference, subject, category, priority, status, created_at, last_message_at, platform_last_seen_at, created_by_name"
    )
    .order("last_message_at", { ascending: false })
    .limit(500);

  const status = filters.status ?? "active";
  if (status === "active") query = query.in("status", ACTIVE_STATUSES);
  else if (status !== "all") query = query.eq("status", status);
  if (filters.priority && filters.priority !== "all") query = query.eq("priority", filters.priority);
  if (filters.tenantId && filters.tenantId !== "all") query = query.eq("tenant_id", filters.tenantId);

  const [{ data, error }, { data: tenants }, { data: activeRows }] = await Promise.all([
    query,
    admin.from("tenants").select("id, name").order("name"),
    admin
      .from("platform_support_tickets")
      .select("id, priority, platform_last_seen_at")
      .in("status", ACTIVE_STATUSES),
  ]);

  if (error) {
    return {
      tickets: [],
      agencies: [],
      counts: { active: 0, unread: 0, urgent: 0 },
      unavailable: true,
    };
  }

  const rows = data ?? [];
  const tenantNames = new Map((tenants ?? []).map((t) => [t.id as string, t.name as string]));

  // Latest AGENCY message per ticket (internal notes are platform-side, so
  // they're excluded automatically) — drives the unread dot.
  const idsForUnread = Array.from(
    new Set([...rows.map((r) => r.id as string), ...(activeRows ?? []).map((r) => r.id as string)])
  );
  const latestAgency = new Map<string, string>();
  if (idsForUnread.length > 0) {
    const { data: agencyMsgs } = await admin
      .from("platform_support_messages")
      .select("ticket_id, created_at")
      .eq("author_side", "agency")
      .in("ticket_id", idsForUnread)
      .order("created_at", { ascending: false });
    for (const m of agencyMsgs ?? []) {
      if (!latestAgency.has(m.ticket_id as string)) latestAgency.set(m.ticket_id as string, m.created_at as string);
    }
  }

  function isUnread(id: string, seen: string | null): boolean {
    // Never opened by us at all → unread.
    if (!seen) return true;
    const latest = latestAgency.get(id);
    return !!latest && latest > seen;
  }

  const tickets: AdminSupportTicketListItem[] = rows.map((r) => ({
    id: r.id as string,
    tenant_id: r.tenant_id as string,
    tenant_name: tenantNames.get(r.tenant_id as string) ?? "Unknown agency",
    reference: r.reference as string,
    subject: r.subject as string,
    category: r.category as TicketCategory,
    priority: r.priority as TicketPriority,
    status: r.status as TicketStatus,
    created_at: r.created_at as string,
    last_message_at: r.last_message_at as string,
    created_by_name: r.created_by_name as string,
    unread: isUnread(r.id as string, (r.platform_last_seen_at as string | null) ?? null),
  }));

  const active = activeRows ?? [];
  return {
    tickets,
    agencies: (tenants ?? []).map((t) => ({ id: t.id as string, name: t.name as string })),
    counts: {
      active: active.length,
      unread: active.filter((r) =>
        isUnread(r.id as string, (r.platform_last_seen_at as string | null) ?? null)
      ).length,
      urgent: active.filter((r) => r.priority === "urgent").length,
    },
    unavailable: false,
  };
}

export async function getTicketForPlatform(ticketId: string): Promise<AdminSupportTicketDetail | null> {
  await requireSuperAdmin();
  const admin = createSupabaseAdminClient();

  const { data: t, error } = await admin
    .from("platform_support_tickets")
    .select(
      "id, tenant_id, reference, subject, body, category, priority, status, created_by_name, created_by_email, created_at, last_message_at, resolved_at, page_url, user_agent, app_version, tenants(name)"
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!t) return null;

  const [{ data: msgs }, { data: atts }] = await Promise.all([
    admin
      .from("platform_support_messages")
      .select("id, author_name, author_side, is_internal, body, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
    admin
      .from("platform_support_attachments")
      .select(ATTACHMENT_COLUMNS)
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
  ]);

  await admin
    .from("platform_support_tickets")
    .update({ platform_last_seen_at: new Date().toISOString() })
    .eq("id", ticketId);

  const tenantRel = (t as { tenants?: { name: string } | { name: string }[] | null }).tenants;
  const tenantName = Array.isArray(tenantRel) ? tenantRel[0]?.name : tenantRel?.name;

  const { tenants: _omit, ...rest } = t as typeof t & { tenants?: unknown };
  void _omit;

  return {
    ...(rest as Omit<AdminSupportTicketDetail, "messages" | "attachments" | "tenant_name">),
    tenant_name: tenantName ?? "Unknown agency",
    messages: (msgs ?? []) as SupportMessage[],
    attachments: await signAttachments(atts ?? []),
  };
}


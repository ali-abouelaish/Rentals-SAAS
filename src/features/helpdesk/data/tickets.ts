import "server-only";

import { requireUserProfile } from "@/lib/auth/requireRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ATTACHMENT_COLUMNS, signAttachments } from "./attachments";
import type {
  SupportMessage,
  SupportTicketDetail,
  SupportTicketListItem,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "../domain/types";

// Agency-side reads. Everything goes through the RLS-scoped client, which
// already limits a user to the tickets they raised and hides internal notes;
// the explicit created_by filter is belt and braces on top of that.

const LIST_COLUMNS =
  "id, reference, subject, category, priority, status, created_at, last_message_at, agency_last_seen_at";

export async function listMyTickets(): Promise<SupportTicketListItem[]> {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("platform_support_tickets")
    .select(LIST_COLUMNS)
    .eq("created_by", profile.id)
    .order("last_message_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Latest platform reply per ticket, to drive the unread dot. RLS already
  // strips internal notes, so an internal note can never light it up.
  const { data: replies } = await supabase
    .from("platform_support_messages")
    .select("ticket_id, created_at")
    .eq("author_side", "platform")
    .in(
      "ticket_id",
      rows.map((r) => r.id as string)
    )
    .order("created_at", { ascending: false });

  const latestReply = new Map<string, string>();
  for (const r of replies ?? []) {
    if (!latestReply.has(r.ticket_id as string)) latestReply.set(r.ticket_id as string, r.created_at as string);
  }

  return rows.map((r) => {
    const reply = latestReply.get(r.id as string);
    const seen = (r.agency_last_seen_at as string | null) ?? null;
    return {
      id: r.id as string,
      reference: r.reference as string,
      subject: r.subject as string,
      category: r.category as TicketCategory,
      priority: r.priority as TicketPriority,
      status: r.status as TicketStatus,
      created_at: r.created_at as string,
      last_message_at: r.last_message_at as string,
      unread: !!reply && (!seen || reply > seen),
    };
  });
}

/** Returns null when the ticket doesn't exist OR isn't the caller's. */
export async function getTicketForAgency(ticketId: string): Promise<SupportTicketDetail | null> {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();

  const { data: t, error } = await supabase
    .from("platform_support_tickets")
    .select(
      "id, tenant_id, reference, subject, body, category, priority, status, created_by_name, created_by_email, created_at, last_message_at, resolved_at"
    )
    .eq("id", ticketId)
    .eq("created_by", profile.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!t) return null;

  const [{ data: msgs }, { data: atts }] = await Promise.all([
    supabase
      .from("platform_support_messages")
      .select("id, author_name, author_side, is_internal, body, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
    supabase
      .from("platform_support_attachments")
      .select(ATTACHMENT_COLUMNS)
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
  ]);

  // Mark seen. The agency has no UPDATE policy on tickets, so this uses the
  // service role — safe because RLS just proved the row is the caller's.
  const admin = createSupabaseAdminClient();
  await admin
    .from("platform_support_tickets")
    .update({ agency_last_seen_at: new Date().toISOString() })
    .eq("id", ticketId);

  return {
    ...(t as Omit<SupportTicketDetail, "messages" | "attachments">),
    // Defence in depth: RLS already hides these.
    messages: ((msgs ?? []) as SupportMessage[]).filter((m) => !m.is_internal),
    attachments: await signAttachments(atts ?? []),
  };
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logPlatformAudit } from "@/lib/audit/platformAudit";
import { removeSupportFiles, uploadSupportFile } from "../data/attachments";
import { notifyAgencyOfPlatformReply, notifyAgencyOfStatusChange } from "../data/notifications";
import {
  MAX_ATTACHMENTS,
  STATUS_LABELS_PLATFORM,
  ticketMessageSchema,
  ticketStatusSchema,
  validateAttachment,
  type ActionResult,
  type TicketStatus,
} from "../domain/types";

// Platform-side writes. Service role behind requireSuperAdmin() — there is no
// RLS policy for any of this by design (see the migration header).

/** The name agencies see on our replies. Individual admin names stay internal. */
const PLATFORM_AUTHOR_NAME = "Harbor Ops Support";

const TICKET_COLUMNS = "id, tenant_id, reference, subject, status, created_by_name, created_by_email";

async function loadTicket(ticketId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("platform_support_tickets").select(TICKET_COLUMNS).eq("id", ticketId).maybeSingle();
  return data as
    | {
        id: string;
        tenant_id: string;
        reference: string;
        subject: string;
        status: TicketStatus;
        created_by_name: string;
        created_by_email: string;
      }
    | null;
}

function revalidateTicket(ticketId: string) {
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/helpdesk");
  revalidatePath(`/helpdesk/${ticketId}`);
}

/**
 * Post a reply to the agency, or an internal note (never visible to them).
 * A public reply may also move the ticket to a new status in the same step.
 */
export async function addPlatformMessage(ticketId: string, formData: FormData): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  if (!z.string().uuid().safeParse(ticketId).success) return { ok: false, error: "Invalid ticket" };

  const parsed = ticketMessageSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid message" };

  const isInternal = formData.get("internal") === "true";
  const rawStatus = formData.get("status");
  const nextStatus = rawStatus ? ticketStatusSchema.safeParse(rawStatus) : null;
  if (nextStatus && !nextStatus.success) return { ok: false, error: "Invalid status" };

  const files = formData
    .getAll("files")
    .filter((f): f is File => typeof f === "object" && f !== null && "size" in f && (f as File).size > 0);
  if (files.length > MAX_ATTACHMENTS) return { ok: false, error: `Attach at most ${MAX_ATTACHMENTS} files` };
  for (const f of files) {
    const err = validateAttachment(f);
    if (err) return { ok: false, error: err };
  }

  const ticket = await loadTicket(ticketId);
  if (!ticket) return { ok: false, error: "Ticket not found" };

  const admin = createSupabaseAdminClient();
  const { data: message, error } = await admin
    .from("platform_support_messages")
    .insert({
      ticket_id: ticketId,
      tenant_id: ticket.tenant_id,
      author_user_id: actor.id,
      author_name: isInternal ? actor.display_name?.trim() || "Super admin" : PLATFORM_AUTHOR_NAME,
      author_side: "platform",
      is_internal: isInternal,
      body: parsed.data.body,
    })
    .select("id")
    .single();
  if (error || !message) return { ok: false, error: error?.message ?? "Couldn't post the message" };

  let failed = 0;
  for (const file of files) {
    const path = await uploadSupportFile(ticket.tenant_id, ticketId, file);
    if (!path) {
      failed++;
      continue;
    }
    const { error: rowErr } = await admin.from("platform_support_attachments").insert({
      ticket_id: ticketId,
      message_id: message.id,
      tenant_id: ticket.tenant_id,
      file_name: file.name.slice(0, 255),
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: path,
      uploaded_by: actor.id,
    });
    if (rowErr) {
      await removeSupportFiles([path]);
      failed++;
    }
  }

  // Status only ever moves on a public reply — an internal note must not
  // change anything the agency can see.
  let status = ticket.status;
  if (!isInternal && nextStatus?.success && nextStatus.data !== ticket.status) {
    status = nextStatus.data;
    await admin
      .from("platform_support_tickets")
      .update({
        status,
        resolved_at: status === "resolved" || status === "closed" ? new Date().toISOString() : null,
      })
      .eq("id", ticketId);
  }

  await logPlatformAudit({
    actor,
    category: "tenant",
    action: isInternal ? "support_ticket.noted" : "support_ticket.replied",
    summary: `${isInternal ? "Internal note on" : "Replied to"} ${ticket.reference}${
      status !== ticket.status ? ` and set status to ${STATUS_LABELS_PLATFORM[status]}` : ""
    }`,
    tenantId: ticket.tenant_id,
    entityType: "platform_support_ticket",
    entityId: ticketId,
    before: status !== ticket.status ? { status: ticket.status } : null,
    after: status !== ticket.status ? { status } : null,
  });

  if (!isInternal) {
    try {
      await notifyAgencyOfPlatformReply(ticket, parsed.data.body, status);
    } catch (err) {
      console.error("[helpdesk.platform-reply-email]", err);
    }
  }

  revalidateTicket(ticketId);
  return {
    ok: true,
    id: message.id as string,
    ...(failed > 0 ? { warning: `${failed} attachment(s) couldn't be uploaded` } : {}),
  };
}

export async function updateSupportTicketStatus(
  ticketId: string,
  rawStatus: string,
  notify: boolean
): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  if (!z.string().uuid().safeParse(ticketId).success) return { ok: false, error: "Invalid ticket" };
  const parsed = ticketStatusSchema.safeParse(rawStatus);
  if (!parsed.success) return { ok: false, error: "Invalid status" };

  const ticket = await loadTicket(ticketId);
  if (!ticket) return { ok: false, error: "Ticket not found" };
  if (ticket.status === parsed.data) return { ok: true };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("platform_support_tickets")
    .update({
      status: parsed.data,
      resolved_at: parsed.data === "resolved" || parsed.data === "closed" ? new Date().toISOString() : null,
    })
    .eq("id", ticketId);
  if (error) return { ok: false, error: error.message };

  await logPlatformAudit({
    actor,
    category: "tenant",
    action: "support_ticket.status_changed",
    summary: `Set ${ticket.reference} to ${STATUS_LABELS_PLATFORM[parsed.data]}`,
    tenantId: ticket.tenant_id,
    entityType: "platform_support_ticket",
    entityId: ticketId,
    before: { status: ticket.status },
    after: { status: parsed.data },
  });

  if (notify) {
    try {
      await notifyAgencyOfStatusChange(ticket, parsed.data);
    } catch (err) {
      console.error("[helpdesk.status-email]", err);
    }
  }

  revalidateTicket(ticketId);
  return { ok: true };
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { getUserFromAccessTokenCookie } from "@/lib/auth/jwt";
import { hasFeature } from "@/lib/entitlements/requireFeature";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { removeSupportFiles, uploadSupportFile } from "../data/attachments";
import { notifyPlatformOfAgencyReply, notifyPlatformOfNewTicket } from "../data/notifications";
import {
  MAX_ATTACHMENTS,
  createTicketSchema,
  ticketContextSchema,
  ticketMessageSchema,
  validateAttachment,
  type ActionResult,
  type TicketCategory,
  type TicketPriority,
} from "../domain/types";

const MAX_REF_ATTEMPTS = 5;

function formatReference(year: number, seq: number): string {
  return `SUP-${year}-${String(seq).padStart(6, "0")}`;
}

/** Platform-wide per-year sequence. Counting needs the service role — an agency
 *  user can only see their own tickets. Collisions are retried on 23505. */
async function peekNextSeq(year: number): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from("platform_support_tickets")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.UTC(year, 0, 1)).toISOString())
    .lt("created_at", new Date(Date.UTC(year + 1, 0, 1)).toISOString());
  return (count ?? 0) + 1;
}

function authorNameOf(profile: { display_name?: string | null }, email: string | null): string {
  return profile.display_name?.trim() || email || "Agency user";
}

function filesFrom(formData: FormData): File[] {
  return formData
    .getAll("files")
    .filter((f): f is File => typeof f === "object" && f !== null && "size" in f && (f as File).size > 0);
}

function validateFiles(files: File[]): string | null {
  if (files.length > MAX_ATTACHMENTS) return `Attach at most ${MAX_ATTACHMENTS} files`;
  for (const f of files) {
    const err = validateAttachment(f);
    if (err) return err;
  }
  return null;
}

/**
 * Upload files and record them against the ticket (and optionally a message).
 * Rows are inserted through the RLS client, so the attachments policy — not
 * just this code — enforces ownership. Returns how many were stored.
 */
async function storeAttachments(args: {
  tenantId: string;
  ticketId: string;
  messageId: string | null;
  userId: string;
  files: File[];
}): Promise<{ stored: number; failed: number }> {
  if (args.files.length === 0) return { stored: 0, failed: 0 };
  const supabase = createSupabaseServerClient();
  let stored = 0;
  let failed = 0;

  for (const file of args.files) {
    const path = await uploadSupportFile(args.tenantId, args.ticketId, file);
    if (!path) {
      failed++;
      continue;
    }
    const { error } = await supabase.from("platform_support_attachments").insert({
      ticket_id: args.ticketId,
      message_id: args.messageId,
      tenant_id: args.tenantId,
      file_name: file.name.slice(0, 255),
      mime_type: file.type,
      size_bytes: file.size,
      storage_path: path,
      uploaded_by: args.userId,
    });
    if (error) {
      console.error("[helpdesk.attachment-row]", error.message);
      await removeSupportFiles([path]);
      failed++;
    } else {
      stored++;
    }
  }
  return { stored, failed };
}

export async function createSupportTicket(formData: FormData): Promise<ActionResult> {
  const profile = await requireUserProfile();
  if (!(await hasFeature("support_tickets"))) {
    return { ok: false, error: "Support tickets aren't enabled for your agency." };
  }

  const parsed = createTicketSchema.safeParse({
    subject: formData.get("subject"),
    category: formData.get("category"),
    priority: formData.get("priority"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Please check the form" };
  }
  const context = ticketContextSchema.safeParse({
    page_url: formData.get("page_url") || null,
    user_agent: formData.get("user_agent") || null,
  });

  const files = filesFrom(formData);
  const fileError = validateFiles(files);
  if (fileError) return { ok: false, error: fileError };

  const email = getUserFromAccessTokenCookie()?.email ?? null;
  if (!email) return { ok: false, error: "Couldn't determine your email address. Please sign in again." };

  const supabase = createSupabaseServerClient();
  const year = new Date().getUTCFullYear();
  const input = parsed.data;

  let ticket: { id: string; reference: string } | null = null;
  let lastError: string | null = null;
  for (let attempt = 0; attempt < MAX_REF_ATTEMPTS; attempt++) {
    const reference = formatReference(year, (await peekNextSeq(year)) + attempt);
    const { data, error } = await supabase
      .from("platform_support_tickets")
      .insert({
        tenant_id: profile.tenant_id,
        reference,
        created_by: profile.id,
        created_by_name: authorNameOf(profile, email),
        created_by_email: email,
        subject: input.subject,
        body: input.body,
        category: input.category,
        priority: input.priority,
        status: "open",
        page_url: context.success ? context.data.page_url ?? null : null,
        user_agent: context.success ? context.data.user_agent ?? null : null,
        app_version: process.env.APP_VERSION ?? process.env.npm_package_version ?? null,
      })
      .select("id, reference")
      .single();

    if (!error && data) {
      ticket = { id: data.id as string, reference: data.reference as string };
      break;
    }
    lastError = error?.message ?? "Couldn't create the ticket";
    if ((error as { code?: string } | null)?.code !== "23505") break;
  }
  if (!ticket) return { ok: false, error: lastError ?? "Couldn't create the ticket" };

  const { stored, failed } = await storeAttachments({
    tenantId: profile.tenant_id,
    ticketId: ticket.id,
    messageId: null,
    userId: profile.id,
    files,
  });

  try {
    await notifyPlatformOfNewTicket(
      {
        id: ticket.id,
        tenant_id: profile.tenant_id,
        reference: ticket.reference,
        subject: input.subject,
        body: input.body,
        category: input.category as TicketCategory,
        priority: input.priority as TicketPriority,
        status: "open",
        created_by_name: authorNameOf(profile, email),
        created_by_email: email,
        page_url: context.success ? context.data.page_url ?? null : null,
      },
      stored
    );
  } catch (err) {
    console.error("[helpdesk.new-ticket-email]", err);
  }

  revalidatePath("/helpdesk");
  revalidatePath("/admin/support");
  if (failed > 0) {
    // The ticket exists; say which part didn't make it rather than failing
    // the whole submission.
    return { ok: true, id: ticket.id, warning: `${failed} attachment(s) couldn't be uploaded` };
  }
  return { ok: true, id: ticket.id };
}

export async function addAgencyMessage(ticketId: string, formData: FormData): Promise<ActionResult> {
  const profile = await requireUserProfile();
  if (!z.string().uuid().safeParse(ticketId).success) return { ok: false, error: "Invalid ticket" };

  const parsed = ticketMessageSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid message" };

  const files = filesFrom(formData);
  const fileError = validateFiles(files);
  if (fileError) return { ok: false, error: fileError };

  const supabase = createSupabaseServerClient();

  // RLS returns nothing for someone else's ticket — same answer as "not found".
  const { data: ticket } = await supabase
    .from("platform_support_tickets")
    .select("id, tenant_id, reference, subject, status, created_by_email")
    .eq("id", ticketId)
    .eq("created_by", profile.id)
    .maybeSingle();
  if (!ticket) return { ok: false, error: "Ticket not found" };
  if (ticket.status === "closed") {
    return { ok: false, error: "This ticket is closed. Please raise a new ticket." };
  }

  const email = getUserFromAccessTokenCookie()?.email ?? null;
  const authorName = authorNameOf(profile, email);

  const { data: message, error } = await supabase
    .from("platform_support_messages")
    .insert({
      ticket_id: ticketId,
      tenant_id: profile.tenant_id,
      author_user_id: profile.id,
      author_name: authorName,
      author_side: "agency",
      is_internal: false,
      body: parsed.data.body,
    })
    .select("id")
    .single();
  if (error || !message) return { ok: false, error: error?.message ?? "Couldn't send your reply" };

  const { stored, failed } = await storeAttachments({
    tenantId: profile.tenant_id,
    ticketId,
    messageId: message.id as string,
    userId: profile.id,
    files,
  });

  try {
    await notifyPlatformOfAgencyReply(
      {
        id: ticketId,
        tenant_id: ticket.tenant_id as string,
        reference: ticket.reference as string,
        subject: ticket.subject as string,
        created_by_email: ticket.created_by_email as string,
      },
      authorName,
      parsed.data.body,
      stored
    );
  } catch (err) {
    console.error("[helpdesk.agency-reply-email]", err);
  }

  revalidatePath(`/helpdesk/${ticketId}`);
  revalidatePath("/helpdesk");
  return {
    ok: true,
    id: message.id as string,
    ...(failed > 0 ? { warning: `${failed} attachment(s) couldn't be uploaded` } : {}),
  };
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { sendTicketCommentNotification } from "@/features/support/data/notifications";
import type { MaintenanceJobComment } from "../domain/types";
import type { MaintenanceTicketComment } from "../domain/ticket-types";

// ──────────────────────────────────────────────────────────
// Schema (mirrored client-side in the drawer composers)
// ──────────────────────────────────────────────────────────

const CommentBodySchema = z
  .string()
  .trim()
  .min(1, "Comment can't be empty")
  .max(2000, "Max 2000 characters");

function authorNameOf(profile: { display_name?: string | null; email?: string | null }): string {
  return profile.display_name?.trim() || profile.email || "Staff";
}

// ──────────────────────────────────────────────────────────
// Ticket comments — visible to the renter in /support
// ──────────────────────────────────────────────────────────

export async function addTicketComment(ticketId: string, rawBody: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  if (!z.string().uuid().safeParse(ticketId).success) return { error: "Invalid ticket id" };
  const parsed = CommentBodySchema.safeParse(rawBody);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid comment" };
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("maintenance_ticket_comments")
    .insert({
      tenant_id: profile.tenant_id,
      ticket_id: ticketId,
      author_user_id: profile.id,
      author_name: authorNameOf(profile),
      body: parsed.data,
    })
    .select("id, author_name, body, created_at")
    .single();
  if (error) return { error: error.message };

  // Notify the renter by email (queued via email_outbox); a delivery
  // failure must not block the comment itself.
  try {
    await sendTicketCommentNotification({
      ticketId,
      authorName: authorNameOf(profile),
      commentBody: parsed.data,
    });
  } catch (emailErr) {
    console.error("[maintenance.ticket-comment-email]", emailErr);
  }

  revalidatePath("/maintenance");
  return { success: true, comment: data as MaintenanceTicketComment };
}

export async function deleteTicketComment(commentId: string) {
  await requireRole([...ADMIN_ROLES]);
  if (!z.string().uuid().safeParse(commentId).success) return { error: "Invalid comment id" };
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("maintenance_ticket_comments")
    .delete()
    .eq("id", commentId);
  if (error) return { error: error.message };

  revalidatePath("/maintenance");
  return { success: true };
}

// ──────────────────────────────────────────────────────────
// Job comments — internal staff notes only
// ──────────────────────────────────────────────────────────

export async function addJobComment(jobId: string, rawBody: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  if (!z.string().uuid().safeParse(jobId).success) return { error: "Invalid job id" };
  const parsed = CommentBodySchema.safeParse(rawBody);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid comment" };
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("maintenance_job_comments")
    .insert({
      tenant_id: profile.tenant_id,
      job_id: jobId,
      author_user_id: profile.id,
      author_name: authorNameOf(profile),
      body: parsed.data,
    })
    .select("*")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/maintenance");
  return { success: true, comment: data as MaintenanceJobComment };
}

export async function deleteJobComment(commentId: string) {
  await requireRole([...ADMIN_ROLES]);
  if (!z.string().uuid().safeParse(commentId).success) return { error: "Invalid comment id" };
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("maintenance_job_comments")
    .delete()
    .eq("id", commentId);
  if (error) return { error: error.message };

  revalidatePath("/maintenance");
  return { success: true };
}

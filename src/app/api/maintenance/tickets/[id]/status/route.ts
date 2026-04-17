import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendTicketStatusChange } from "@/features/support/data/notifications";

export const runtime = "nodejs";

const VALID_STATUSES = new Set([
  "open",
  "acknowledged",
  "in_progress",
  "pending_parts",
  "pending_quote",
  "resolved",
  "closed",
  "cancelled",
]);

const STAFF_ROLES = new Set(["admin", "super_admin", "manager"]);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, role, tenant_id")
    .eq("id", session.user.id)
    .single();

  if (!profile || !STAFF_ROLES.has((profile.role ?? "").toLowerCase())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const newStatus = body.status;
  if (!newStatus || !VALID_STATUSES.has(newStatus)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: ticket } = await admin
    .from("maintenance_tickets")
    .select("id, tenant_id, status")
    .eq("id", params.id)
    .maybeSingle();

  if (!ticket || ticket.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const oldStatus = ticket.status as string;
  if (oldStatus === newStatus) {
    return NextResponse.json({ ok: true, status: newStatus, unchanged: true });
  }

  const updates: Record<string, unknown> = { status: newStatus };
  if (newStatus === "resolved" || newStatus === "closed") {
    updates.resolved_at = new Date().toISOString();
  }

  const { error } = await admin
    .from("maintenance_tickets")
    .update(updates)
    .eq("id", params.id);

  if (error) {
    console.error("[maintenance.tickets.status]", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  try {
    await sendTicketStatusChange({
      ticketId: params.id,
      oldStatus,
      newStatus,
    });
  } catch (emailErr) {
    console.error("[maintenance.tickets.status-email]", emailErr);
  }

  return NextResponse.json({ ok: true, status: newStatus });
}

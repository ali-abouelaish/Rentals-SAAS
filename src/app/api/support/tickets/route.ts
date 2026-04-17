import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveSupportTenantFromRequest } from "@/features/support/data/resolveTenant";
import { loadConversationContext } from "@/features/support/data/conversations";
import { getAttachmentsForConversation } from "@/features/support/data/attachments";
import { createTicket } from "@/features/support/data/tickets";
import {
  sendTicketConfirmation,
  sendLandlordP0Alert,
} from "@/features/support/data/notifications";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const tenant = await resolveSupportTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  let body: { conversationId?: string; description?: string; attachmentIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const conversationId = body.conversationId;
  const description = body.description?.trim();
  const attachmentIds = Array.isArray(body.attachmentIds) ? body.attachmentIds : [];

  if (!conversationId || !description) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const bundle = await loadConversationContext({
    conversationId,
    tenantId: tenant.id,
  });
  if (!bundle) {
    return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
  }

  const attachments = await getAttachmentsForConversation(
    tenant.id,
    conversationId,
    attachmentIds
  );
  const hasImage = attachments.some((a) => a.kind === "image");
  if (!hasImage) {
    return NextResponse.json({ error: "image_required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: conv } = await admin
    .from("maintenance_conversations")
    .select("property_id, unit_id, pm_tenant_id, status, emergency_type")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) {
    return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
  }

  const isEmergency = conv.status === "emergency";
  const emergencyType = (conv.emergency_type as string | null) ?? null;

  try {
    const ticket = await createTicket({
      tenantId: tenant.id,
      propertyId: conv.property_id as string,
      unitId: conv.unit_id as string,
      pmTenantId: conv.pm_tenant_id as string,
      conversationId,
      description,
      priority: isEmergency ? "critical" : "medium",
      attachmentIds: attachments.map((a) => a.id),
    });

    if (!isEmergency) {
      await admin
        .from("maintenance_conversations")
        .update({
          status: "ticket_created",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    }

    try {
      await sendTicketConfirmation(ticket.id);
    } catch (emailErr) {
      console.error("[support.tickets.confirmation-email]", emailErr);
    }
    if (isEmergency && emergencyType) {
      try {
        await sendLandlordP0Alert({ ticketId: ticket.id, emergencyType });
      } catch (emailErr) {
        console.error("[support.tickets.p0-alert-email]", emailErr);
      }
    }

    return NextResponse.json({ reference: ticket.reference, id: ticket.id });
  } catch (err) {
    console.error("[support.tickets.create]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { resolveSupportTenantFromRequest } from "@/features/support/data/resolveTenant";
import {
  appendMessage,
  incrementTurnCount,
  loadConversationContext,
  loadConversationHistory,
  markConversationEmergency,
} from "@/features/support/data/conversations";
import { runTriageTurn } from "@/lib/ai/maintenance-triage";
import { createTicket } from "@/features/support/data/tickets";
import {
  sendTicketConfirmation,
  sendLandlordP0Alert,
  sendPropertyManagerTicketNotification,
} from "@/features/support/data/notifications";

export const runtime = "nodejs";

const SOFT_NUDGE_TURN = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenant = await resolveSupportTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json({ error: "missing_content" }, { status: 400 });
  }

  const bundle = await loadConversationContext({
    conversationId: params.id,
    tenantId: tenant.id,
  });
  if (!bundle) {
    return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
  }
  if (bundle.status !== "active") {
    return NextResponse.json({ error: "conversation_closed" }, { status: 409 });
  }

  try {
    const history = await loadConversationHistory(params.id);

    await appendMessage({
      conversationId: params.id,
      role: "user",
      content,
    });

    const result = await runTriageTurn({
      context: bundle.triage,
      history,
      userMessage: content,
    });

    if (result.kind === "emergency") {
      await appendMessage({
        conversationId: params.id,
        role: "assistant",
        content: result.tenantMessage,
      });
      await markConversationEmergency({
        conversationId: params.id,
        emergencyType: result.type,
      });

      let ticketReference: string | null = null;
      try {
        const ticket = await createTicket({
          tenantId: tenant.id,
          propertyId: bundle.propertyId,
          unitId: bundle.unitId,
          pmTenantId: bundle.pmTenantId,
          conversationId: params.id,
          description: `[${result.type.toUpperCase()}] ${content}`,
          priority: "critical",
          attachmentIds: [],
        });
        ticketReference = ticket.reference;

        try {
          await sendTicketConfirmation(ticket.id);
        } catch (emailErr) {
          console.error("[support.emergency.confirmation-email]", emailErr);
        }
        try {
          await sendPropertyManagerTicketNotification({
            ticketId: ticket.id,
            isEmergency: true,
            emergencyType: result.type,
          });
        } catch (emailErr) {
          console.error("[support.emergency.pm-email]", emailErr);
        }
        try {
          await sendLandlordP0Alert({
            ticketId: ticket.id,
            emergencyType: result.type,
          });
        } catch (emailErr) {
          console.error("[support.emergency.p0-alert-email]", emailErr);
        }
      } catch (ticketErr) {
        // Don't block the emergency response if ticket creation fails — the
        // tenant still needs the number.
        console.error("[support.emergency-ticket]", ticketErr);
      }

      const turnCount = await incrementTurnCount(params.id);
      return NextResponse.json({
        assistantMessage: result.tenantMessage,
        turnCount,
        emergency: {
          type: result.type,
          number: result.number,
          tenantMessage: result.tenantMessage,
          ticketReference,
        },
        shouldSuggestTicket: false,
      });
    }

    await appendMessage({
      conversationId: params.id,
      role: "assistant",
      content: result.assistantMessage,
    });
    const turnCount = await incrementTurnCount(params.id);

    return NextResponse.json({
      assistantMessage: result.assistantMessage,
      turnCount,
      emergency: null,
      shouldSuggestTicket: turnCount >= SOFT_NUDGE_TURN,
    });
  } catch (err) {
    console.error("[support.conversations.messages]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

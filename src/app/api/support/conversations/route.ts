import { NextRequest, NextResponse } from "next/server";
import { resolveSupportTenantFromRequest } from "@/features/support/data/resolveTenant";
import { createConversation } from "@/features/support/data/conversations";
import { appendMessage } from "@/features/support/data/conversations";
import { greetingFor } from "@/lib/ai/maintenance-triage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const tenant = await resolveSupportTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  let body: { propertyId?: string; unitId?: string; pmTenantId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { propertyId, unitId, pmTenantId } = body;
  if (!propertyId || !unitId || !pmTenantId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  try {
    const bundle = await createConversation({
      tenantId: tenant.id,
      propertyId,
      unitId,
      pmTenantId,
    });

    if (!bundle) {
      return NextResponse.json({ error: "invalid_selection" }, { status: 400 });
    }

    const greeting = greetingFor(bundle.triage.tenantFirstName);
    await appendMessage({
      conversationId: bundle.conversationId,
      role: "assistant",
      content: greeting,
    });

    return NextResponse.json({
      conversationId: bundle.conversationId,
      greeting,
      turnCount: bundle.turnCount,
    });
  } catch (err) {
    console.error("[support.conversations.create]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
